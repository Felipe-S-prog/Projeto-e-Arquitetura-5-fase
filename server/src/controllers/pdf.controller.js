// Controller do PDF consolidado (T25): só fala HTTP. Devolve o arquivo como download;
// a quantidade de páginas e os avisos vão nos cabeçalhos X-Pdf-Paginas e X-Pdf-Avisos
// (avisos em JSON codificado com encodeURIComponent, para caber em um cabeçalho).
export function createPdfController(pdfService) {
  function enviarPdf(res, pdf) {
    res.set('Content-Type', 'application/pdf');
    res.set('X-Pdf-Paginas', String(pdf.paginas));
    res.set('X-Pdf-Avisos', encodeURIComponent(JSON.stringify(pdf.avisos)));
    res.attachment(pdf.nomeArquivo); // Content-Disposition: attachment; filename="..."
    res.send(Buffer.from(pdf.bytes));
  }

  return {
    async baixar(req, res) {
      enviarPdf(res, await pdfService.gerar(req.params.aplicacaoId, req.query, req.professorId));
    },

    async baixarGabarito(req, res) {
      enviarPdf(res, await pdfService.gerarGabarito(req.params.aplicacaoId, req.professorId));
    },
  };
}
