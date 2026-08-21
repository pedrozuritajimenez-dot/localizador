/* Consulta el stock de un artículo en la web de Obramat para un almacén concreto.
 *
 * Se ejecuta en el servidor de Netlify (no en el móvil), que es lo que permite
 * saltarse el bloqueo del navegador al pedir datos a otra web.
 *
 * Uso:  /.netlify/functions/stock?codigo=25061883&almacen=santiago
 *
 * Variables de entorno que se configuran en Netlify (Site configuration →
 * Environment variables), sin tocar el código:
 *   OBRAMAT_COOKIE      cookie de sesión con el almacén ya elegido
 *   OBRAMAT_STOCK_API   URL de la API de disponibilidad, con {codigo} y {almacen}
 *                       como huecos. Si no está, se cae al plan B (leer la ficha).
 */

const ALMACENES = {
  santiago: { nombre: "Santiago de Compostela" }
};

const CACHE = new Map();            // evita repetir la misma consulta sin parar
const VIDA_CACHE = 10 * 60 * 1000;  // 10 minutos

const CABECERAS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json; charset=utf-8"
};

const respuesta = (obj, code = 200) => ({
  statusCode: code, headers: CABECERAS, body: JSON.stringify(obj)
});

/* Busca un número de unidades dentro de un JSON o un HTML, probando los nombres
   de campo que suelen usar estas webs. */
function extraeStock(texto) {
  const claves = [
    /(\d+)\s*en\s*stock\s*en\s*Obramat/i,                 // "24 en stock en Obramat Santiago"
    /(\d+)\s*en\s*stock/i,
    /"(?:availableQuantity|stockQuantity|quantityAvailable|availableStock|stock)"\s*:\s*"?(\d+)"?/i,
    /(\d+)\s*(?:unidades|uds\.?)\s*(?:disponibles|en stock)/i
  ];
  for (const re of claves) {
    const m = texto.match(re);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

let ULTIMA = {};   // para el modo diagnóstico

async function pideTexto(url, cookie) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
      "Accept-Language": "es-ES,es;q=0.9",
      ...(cookie ? { Cookie: cookie } : {})
    }
  });
  const txt = await r.text();
  ULTIMA = {
    url, status: r.status, tam: txt.length,
    bloqueado: /datadome|captcha|are you a human|acceso denegado/i.test(txt.slice(0, 4000)),
    almacenVisto: (txt.match(/Obramat\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+/i) || [])[0] || null,
    muestra: txt.replace(/\s+/g, " ").slice(0, 400)
  };
  if (!r.ok) throw new Error("HTTP " + r.status);
  return txt;
}

exports.handler = async (event) => {
  const codigo  = (event.queryStringParameters?.codigo || "").replace(/\D/g, "");
  const almacen = event.queryStringParameters?.almacen || "santiago";

  if (!codigo) return respuesta({ error: "Falta el código" }, 400);
  if (!ALMACENES[almacen]) return respuesta({ error: "Almacén desconocido" }, 400);

  const clave = almacen + ":" + codigo;
  const guardado = CACHE.get(clave);
  if (guardado && Date.now() - guardado.t < VIDA_CACHE) {
    return respuesta({ ...guardado.datos, cache: true });
  }

  const cookie = process.env.OBRAMAT_COOKIE || "";
  const api    = process.env.OBRAMAT_STOCK_API || "";

  try {
    let stock = null, precio = null, nombre = null, via = null;

    // Plan A: la API de disponibilidad, si nos han dado la dirección
    if (api) {
      const url = api.replace(/\{codigo\}/g, codigo).replace(/\{almacen\}/g, almacen);
      const txt = await pideTexto(url, cookie);
      stock = extraeStock(txt);
      via = "api";
    }

    // Plan B: leer la ficha del producto con la cookie del almacén.
    // La URL lleva un nombre largo delante del código; probamos varias formas
    // y nos quedamos con la que responda (la web redirige por el código).
    if (stock === null) {
      const candidatas = [
        process.env.OBRAMAT_URL_BASE ? process.env.OBRAMAT_URL_BASE.replace("{codigo}", codigo) : null,
        `https://www.obramat.es/productos/p-${codigo}.html`,
        `https://www.obramat.es/productos/-${codigo}.html`,
        `https://www.obramat.es/${codigo}.html`
      ].filter(Boolean);
      let txt = null;
      for (const u of candidatas) {
        try { txt = await pideTexto(u, cookie); if (txt && txt.length > 5000) break; } catch (e) { txt = null; }
      }
      if (!txt) throw new Error("No se encontró la ficha del producto");
      stock  = extraeStock(txt);
      const mp = txt.match(/(\d+[.,]?\d*)\s*(?:EUR|€)/);
      if (mp) precio = mp[1].replace(",", ".");
      const mn = txt.match(/<title>([^<|]+)/i);
      if (mn) nombre = mn[1].trim();
      via = via || "ficha";
    }

    const datos = {
      codigo, almacen: ALMACENES[almacen].nombre,
      stock, precio, nombre, via,
      actualizado: new Date().toISOString()
    };
    // ?debug=1 devuelve qué vio realmente el servidor: sirve para saber si la web
    // nos ha echado (bloqueado:true) o si simplemente no dimos con la ficha.
    if (event.queryStringParameters?.debug) {
      return respuesta({ ...datos, diagnostico: ULTIMA, cookiePuesta: !!cookie });
    }
    CACHE.set(clave, { t: Date.now(), datos });
    return respuesta(datos);

  } catch (e) {
    return respuesta({ codigo, almacen: ALMACENES[almacen].nombre, stock: null,
                       error: "No se pudo consultar la web: " + e.message,
                       diagnostico: ULTIMA, cookiePuesta: !!cookie }, 200);
  }
};
