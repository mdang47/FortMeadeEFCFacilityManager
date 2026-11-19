var PMDom = (function () {
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function clear(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function show(node, on) {
    if (!node) return;
    if (on) node.classList.remove('hide');
    else node.classList.add('hide');
  }

  return { el: el, clear: clear, show: show };
})();
