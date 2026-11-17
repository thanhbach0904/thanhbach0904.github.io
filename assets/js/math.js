// kramdown emits \(..\) and \[..\]; only those delimiters, so stray "$" in prose stays text.
// Deferred scripts run in document order, so this finishes before note-graph.js clones notes.
if (window.renderMathInElement) {
  renderMathInElement(document.body, {
    delimiters: [
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false }
    ],
    throwOnError: false
  });
}
