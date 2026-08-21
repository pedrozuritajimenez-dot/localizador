/* =====================================================================
   ACTUALIZAR STOCK — se ejecuta en TU navegador, no en un servidor.
   Por eso funciona: usa tus cookies y tu sesión, con Santiago ya elegido,
   y el sistema anti-robots de la web te ve como lo que eres, un empleado
   mirando fichas.

   CÓMO SE USA
   1. Abre www.obramat.es y asegúrate de que arriba pone Obramat Santiago.
   2. Pulsa F12 y ve a la pestaña Console.
   3. Si Chrome avisa de que no se puede pegar, escribe:  allow pasting
      y pulsa Enter. Solo hay que hacerlo una vez.
   4. Pega TODO este archivo y pulsa Enter.
   5. Tarda unos 10 minutos (va despacio a propósito, para no molestar a la web).
      Al terminar se descarga solo un archivo stock-santiago.csv.
   6. En la app: mantén pulsado el título "Localizador" un segundo, pega el
      contenido de ese CSV en el recuadro de stock y dale a Cargar stock.
   ===================================================================== */

(async () => {
  const CODIGOS = ["25061896","25061839","25078573","25078572","25061899","25061802","25061789","25061800","25061783","25061895","25062107","25061872","25061870","25061769","25061766","25138192","25138190","25138191","25032924","25099301","25098515","25076842","25099217","25136742","25094902","25076836","25061878","25061879","25061787","25061803","25061784","25061788","25061897","25062105","25061881","25061768","25061785","25061801","25061786","25061782","25061898","25062106","25061838","25061871","25061880","25061883","25138202","25138203","25138204","25032925","25099311","25098514","25076843","25099218","25136743","25050874","25050875","25061890","25061891","25062108","25062109","25061882","25061767","25098513","25094901","25099216","25136741","25094900","25076865","25050871","25050868","25050872","25050877","25076856","25076855","10951395","10951416","10951752","10951346","10951423","10951766","25076649","25076692","25076682","10951451","10951773","10951472","10951780","25076700","25076710","10951563","10951794","10951570","10951801","25076659","25076680","10951584","10951605","25076669","10951612","10951626","25076681","10951633","10951640","25076679","10951654","10951661","25076690","10951675","10951682","25076691","10960733","10960740","10960754","25043204","25043205","25050816","25050804","25050817","25050808","25050810","25053201","25050813","25050809","25050806","25053185","25050805","25050811","25050803","25050821","25050818","25053184","25053188","25053187","25053202","25053186","25050820","25050814","25050819","25053189","10883656","10883684","10883691","10883705","10883726","10883740","25062777","25062778","25062779","25144652","25144653","25144638","25144639","25045156","10960712","10960726","25043191","10952704","25043192","25032214","25032227","10960593","10960600","10960614","25043218","25043215","10774141","25043217","25043214","10774155","25060818","25060819","25060817","25060816","25060915","25060901","25060918","25060909","25098006","25098005","25098007","25098009","25098008","25098051","25098055","25098054","25098046","25098048","25139168","25139171","25139170","25139172","25032254","25032209","25032233","25032230","10960635","10960642","25127168","25127169","10960572","10960586","25105933","10960670","10960684","25098019","25098021","25098020","25098026","25098025","25098022","25098027","25098034","25098035","25098036","25098037","25098033","25098050","25098052","25098047","25098053","25098057","25098049","25098045","25060542","25060519","25060518","25060543","25060541","25060540","25060529","25060533","25060531","25060528","25060527","25060532","25060530","25127215","25127211","25127212","25127213","25127210","25127214","25130571","25130559","25130570","25043213","25043216","10774162","25043229","25043230","25043221","10774176","25043222","10774183","25049433","25049434","25060826","25060824","25060821","25060823","25060822","25060825","25060827","25060857","25060855","25060853","25060854","25060856","25060916","25060902","25060911","25060914","25060906","25060903","25060919","25060917","25060920","25060900","25060898","25060905","25139190","25139191","25139198","25139193","25139197","25139195","25133133","25062900","25062901","25062902","25062904","25062903","25144637","25144650","25144651","25133134","25069446","25094847","25094845","25094848","25094846","25145738","25142606","25145477","25143281","25145581","25142593","25142615","25142605","25032199","10960663","10960691","10960705","25043209","10952725","25043208","10952732","25043207","10952711","25098024","25098023","25098056","25098044","25060552","25060489","25060550","25060881","25060883","25060880","25060882","25060910","25060899","25060904","25060907","25139196","25139192","25062907","25062908","25062906","25094843","25094842","25094844","25145476","25142616"];

  const PAUSA = 1200;          // ms entre peticiones: no seas ansioso con la web
  const resultados = [];
  const fallos = [];
  let mapa = {};

  const log = (...a) => console.log("%c[stock]", "color:#FFD100;font-weight:bold", ...a);

  /* 1. Localizar la dirección de cada ficha usando el mapa del sitio.
        Las URLs terminan siempre en -CODIGO.html */
  log("Leyendo el mapa del sitio para localizar las fichas…");
  try {
    const robots = await (await fetch("/robots.txt")).text();
    const sitemaps = [...robots.matchAll(/Sitemap:\s*(\S+)/gi)].map(m => m[1]);
    const porVisitar = sitemaps.length ? sitemaps : ["https://www.obramat.es/sitemap.xml"];
    const vistos = new Set();

    while (porVisitar.length) {
      const url = porVisitar.shift();
      if (vistos.has(url)) continue;
      vistos.add(url);
      let xml;
      try { xml = await (await fetch(url)).text(); } catch (e) { continue; }

      // si es un índice de sitemaps, encolamos los hijos
      if (/<sitemapindex/i.test(xml)) {
        [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].forEach(m => {
          if (/product|producto/i.test(m[1])) porVisitar.push(m[1]);
        });
        continue;
      }
      [...xml.matchAll(/<loc>([^<]*?-(\d{7,})\.html)<\/loc>/gi)].forEach(m => { mapa[m[2]] = m[1]; });
      if (Object.keys(mapa).length && porVisitar.length > 40) break;
    }
  } catch (e) { log("No se pudo leer el mapa del sitio, se probará por código directo."); }

  const encontradas = CODIGOS.filter(c => mapa[c]).length;
  log(`Fichas localizadas: ${encontradas} de ${CODIGOS.length}`);

  /* 2. Recorrer cada ficha y sacar el número de stock */
  const RE = [
    /(\d+)\s*en\s*stock\s*en\s*Obramat/i,
    /(\d+)\s*en\s*stock/i,
    /"(?:availableQuantity|stockQuantity|quantity)"\s*:\s*"?(\d+)"?/i
  ];

  for (let i = 0; i < CODIGOS.length; i++) {
    const cod = CODIGOS[i];
    const urls = [mapa[cod], `/productos/p-${cod}.html`].filter(Boolean);
    let stock = null;

    for (const u of urls) {
      try {
        const r = await fetch(u, { credentials: "include" });
        if (!r.ok) continue;
        const html = await r.text();
        for (const re of RE) { const m = html.match(re); if (m) { stock = parseInt(m[1], 10); break; } }
        if (stock !== null) break;
      } catch (e) { /* siguiente candidata */ }
    }

    if (stock === null) fallos.push(cod); else resultados.push([cod, stock]);
    if (i % 20 === 0) log(`${i}/${CODIGOS.length}  ·  con stock: ${resultados.length}  ·  sin dato: ${fallos.length}`);
    await new Promise(r => setTimeout(r, PAUSA));
  }

  /* 3. Descargar el CSV */
  const fecha = new Date().toISOString();   // con hora: la app avisa si el dato envejece
  const csv = "codigo;stock;fecha\n" + resultados.map(([c, s]) => `${c};${s};${fecha}`).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = "stock-santiago.csv";
  a.click();

  log(`LISTO. ${resultados.length} referencias con stock, ${fallos.length} sin dato.`);
  if (fallos.length) log("Sin dato:", fallos.join(", "));
  window.STOCK_CSV = csv;   // por si la descarga falla: copia con  copy(STOCK_CSV)
})();
