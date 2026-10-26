// Prints a compact summary of an `archify validate --json` receipt read from stdin.
let raw = '';
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let receipt;
  try { receipt = JSON.parse(raw); } catch { console.log(raw.slice(0, 2500)); return; }
  console.log(`ok=${receipt.ok} stage=${receipt.stage ?? ''} frozen=${receipt.candidateFrozen ?? ''}`);
  for (const key of ['summary', 'checks', 'validation', 'composition', 'evidence', 'repository']) {
    if (receipt[key]) console.log(`${key}: ${JSON.stringify(receipt[key]).slice(0, 600)}`);
  }
  for (const d of receipt.diagnostics ?? []) {
    console.log(`- ${d.severity} ${d.code} | ${(d.message ?? '').slice(0, 300)}`);
    if (d.evidence) console.log(`    evidence ${JSON.stringify(d.evidence).slice(0, 380)}`);
    if (d.supportedFixes) console.log(`    fixes ${JSON.stringify(d.supportedFixes).slice(0, 220)}`);
  }
  console.log(`keys: ${Object.keys(receipt).join(',')}`);
});
