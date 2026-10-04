// SCRIPT DE GOOGLE ADS: manda a stailist el gasto de los últimos 7 días.
//
// Dónde va: en la cuenta "Stailist", NO en la de administrador.
//   Herramientas → Acciones masivas → Secuencias de comandos → "+" → pegar todo esto.
// Cuándo corre: programarlo "Diario", a las 6 am (hora de la cuenta, CDMX), antes
//   del correo de las 8.
// Qué hace: lee impresiones, clics, costo y conversiones por día y campaña, y
//   los manda a https://stailist.co/api/campana/gasto (ver lib/admin/gasto-ads.ts).
//   Los últimos 7 días y no sólo ayer: Google corrige números durante días.
//
// SECRETO: el valor real NO va en el repo (que es público). Es GASTO_ADS_SECRET,
// en .env.local y en Vercel. Al pegar el script en Google Ads, se reemplaza
// PEGAR_AQUI_EL_SECRETO por ese valor.
//
// El nombre de cada campaña en Google Ads tiene que ser igual a su utm_campaign
// (hombres-diario, app-neutra…): así el panel junta el gasto con la gente que
// trajo. Si se renombra una campaña, renombrar también su utm.

var URL_STAILIST = 'https://stailist.co/api/campana/gasto';
var SECRETO = 'PEGAR_AQUI_EL_SECRETO';

// Google Ads llama a main() solo; nada en este archivo la invoca.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function main() {
  var consulta =
    'SELECT segments.date, campaign.name, metrics.impressions, metrics.clicks, ' +
    'metrics.cost_micros, metrics.conversions ' +
    'FROM campaign ' +
    "WHERE segments.date DURING LAST_7_DAYS AND campaign.status != 'REMOVED'";
  var filas = [];
  var resultados = AdsApp.search(consulta);
  while (resultados.hasNext()) {
    var r = resultados.next();
    filas.push({
      dia: r.segments.date,
      campana: r.campaign.name,
      impresiones: Number(r.metrics.impressions || 0),
      clics: Number(r.metrics.clicks || 0),
      costo_mxn: Number(r.metrics.costMicros || 0) / 1000000,
      registros: Math.round(Number(r.metrics.conversions || 0)),
    });
  }
  var respuesta = UrlFetchApp.fetch(URL_STAILIST, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-stailist-secreto': SECRETO },
    payload: JSON.stringify({ filas: filas }),
    muteHttpExceptions: true,
  });
  Logger.log(filas.length + ' filas → ' + respuesta.getResponseCode() + ' ' + respuesta.getContentText());
}
