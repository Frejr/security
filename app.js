// Link Tree Viewer (YAML)
// Features:
// - Expand all / Collapse all (including descriptions)
// - Search across: names, URLs, descriptions, and category names
// - If url exists: normal link
//   - if description also exists: tooltip on hover + [+] toggle to expand inline description
// - If no url but description exists: clickable title + [+] toggle to expand description
// - If neither: plain text

let ROOT_EL = null;
let ALL_BRANCHES = [];
let ALL_LEAFS = [];

fetch('data.yaml')
  .then(r => r.text())
  .then(yamlText => {
    const data = jsyaml.load(yamlText);
    const container = document.getElementById('tree');
    container.innerHTML = '';

    ALL_BRANCHES = [];
    ALL_LEAFS = [];

    ROOT_EL = renderNode(data);
    container.appendChild(ROOT_EL);

    setStats();
    wireControls();
  })
  .catch(err => {
    document.getElementById('tree').textContent = 'Błąd ładowania data.yaml: ' + err;
  });

function wireControls() {
  const q = document.getElementById('q');
  document.getElementById('expandAll').addEventListener('click', expandAll);
  document.getElementById('collapseAll').addEventListener('click', collapseAll);
  q.addEventListener('input', () => applySearch(q.value));
}

function setStats(extra = '') {
  const stats = document.getElementById('stats');
  stats.textContent = `${ALL_BRANCHES.length} kategorii, ${ALL_LEAFS.length} elementów${extra ? ' • ' + extra : ''}`;
}

function renderNode(node) {
  const ul = document.createElement('ul');
  const keys = Object.keys(node || {}).sort((a, b) => a.localeCompare(b, 'pl'));

  for (const key of keys) {
    const li = document.createElement('li');
    const val = node[key];

    if (Array.isArray(val)) {
      const header = document.createElement('div');
      header.innerHTML = `<span class="twisty"></span><span class="node">${escapeHtml(key)}</span>`;
      li.appendChild(header);

      const children = document.createElement('ul');
      children.className = 'children';

      val.forEach(item => {
        const leafLi = document.createElement('li');

        const name = String(item?.name ?? '').trim();
        const url = String(item?.url ?? '').trim();
        const desc = String(item?.description ?? '');

        let titleEl = null;
        let descEl = null;
        let toggleFn = null;

        if (url) {
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = name || url;

          leafLi.appendChild(a);
          titleEl = a;

          if (desc.trim()) {
            a.title = desc;
            a.setAttribute('aria-label', desc);

            const twisty = document.createElement('span');
            twisty.className = 'muted';
            twisty.style.marginLeft = '6px';
            twisty.textContent = '[+]';

            const pre = document.createElement('pre');
            pre.textContent = desc;
            pre.style.display = 'none';
            pre.style.whiteSpace = 'pre-wrap';
            pre.style.fontFamily = 'inherit';
            pre.style.margin = '6px 0 0';
            pre.style.padding = '8px 10px';
            pre.style.background = '#0b0b0b';
            pre.style.border = '1px solid #333';
            pre.style.borderRadius = '8px';
            pre.style.color = '#ccc';

            toggleFn = () => {
              const open = pre.style.display !== 'none';
              pre.style.display = open ? 'none' : 'block';
              twisty.textContent = open ? '[+]' : '[-]';
            };

            twisty.addEventListener('click', e => {
              e.preventDefault();
              e.stopPropagation();
              toggleFn();
            });

            leafLi.appendChild(twisty);
            leafLi.appendChild(pre);
            descEl = pre;
          }

          if (name && url) {
            const urlSpan = document.createElement('span');
            urlSpan.className = 'muted';
            urlSpan.textContent = `— ${url}`;
            leafLi.appendChild(urlSpan);
          }
        } else if (desc.trim()) {
          const a = document.createElement('a');
          a.href = '#';
          a.textContent = name || '(opis)';

          const twisty = document.createElement('span');
          twisty.className = 'muted';
          twisty.style.marginLeft = '6px';
          twisty.textContent = '[+]';

          const pre = document.createElement('pre');
          pre.textContent = desc;
          pre.style.display = 'none';
          pre.style.whiteSpace = 'pre-wrap';
          pre.style.fontFamily = 'inherit';
          pre.style.margin = '6px 0 0';
          pre.style.padding = '8px 10px';
          pre.style.background = '#0b0b0b';
          pre.style.border = '1px solid #333';
          pre.style.borderRadius = '8px';
          pre.style.color = '#ccc';

          toggleFn = () => {
            const open = pre.style.display !== 'none';
            pre.style.display = open ? 'none' : 'block';
            twisty.textContent = open ? '[+]' : '[-]';
          };

          a.addEventListener('click', e => {
            e.preventDefault();
            toggleFn();
          });

          leafLi.appendChild(a);
          leafLi.appendChild(twisty);
          leafLi.appendChild(pre);

          titleEl = a;
          descEl = pre;
        } else {
          const span = document.createElement('span');
          span.textContent = name || '(brak)';
          leafLi.appendChild(span);
          titleEl = span;
        }

        ALL_LEAFS.push({
          liEl: leafLi,
          titleEl,
          descEl,
          toggleFn,
          rawName: name,
          rawUrl: url,
          rawDesc: desc,
          hasToggleDesc: !url && !!desc.trim(),
          text: `${name} ${url} ${desc}`.toLowerCase()
        });

        children.appendChild(leafLi);
      });

      li.appendChild(children);

      const branch = makeBranch(header, children);
      branch.openFn();
      ALL_BRANCHES.push(branch);

    } else if (val && typeof val === 'object') {
      const header = document.createElement('div');
      const twisty = document.createElement('span');
      twisty.className = 'twisty';
      twisty.textContent = '▸';

      const label = document.createElement('span');
      label.className = 'node';
      label.textContent = key;

      header.appendChild(twisty);
      header.appendChild(label);

      const children = renderNode(val);
      children.className = 'children';
      children.style.display = 'none';

      header.addEventListener('click', () => {
        const closed = children.style.display === 'none';
        children.style.display = closed ? 'block' : 'none';
        twisty.textContent = closed ? '▾' : '▸';
      });

      li.appendChild(header);
      li.appendChild(children);

      ALL_BRANCHES.push(makeBranch(header, children, twisty, label));
    }

    ul.appendChild(li);
  }

  return ul;
}

function makeBranch(headerEl, childrenEl, twistyEl = null, labelEl = null) {
  if (!twistyEl) {
    twistyEl = headerEl.querySelector('.twisty');
    twistyEl.textContent = '▾';
    headerEl.addEventListener('click', () => {
      const closed = childrenEl.style.display === 'none';
      childrenEl.style.display = closed ? 'block' : 'none';
      twistyEl.textContent = closed ? '▾' : '▸';
    });
  }

  return {
    headerEl,
    childrenEl,
    twistyEl,
    labelEl,
    openFn: () => { childrenEl.style.display = 'block'; twistyEl.textContent = '▾'; },
    closeFn: () => { childrenEl.style.display = 'none'; twistyEl.textContent = '▸'; }
  };
}

function expandAll() {
  ALL_BRANCHES.forEach(b => b.openFn());
  ALL_LEAFS.forEach(l => {
    if (l.toggleFn && l.descEl) l.toggleFn();
  });
  setStats('expanded (full)');
}

function collapseAll() {
  ALL_BRANCHES.forEach(b => b.closeFn());
  ALL_LEAFS.forEach(l => {
    if (l.descEl) l.descEl.style.display = 'none';
  });
  setStats('collapsed');
}

function applySearch(query) {
  const q = query.trim().toLowerCase();

  ALL_LEAFS.forEach(l => {
    l.liEl.classList.remove('hidden');
    if (l.titleEl) l.titleEl.innerHTML = escapeHtml(l.rawName || l.rawUrl || l.titleEl.textContent);
    if (l.descEl && l.descEl.tagName === 'PRE') l.descEl.textContent = l.rawDesc;
  });

  if (!q) {
    ROOT_EL.querySelectorAll('li').forEach(li => li.classList.remove('hidden'));
    setStats();
    return;
  }

  let matched = 0;
  ALL_LEAFS.forEach(l => {
    if (!l.text.includes(q)) {
      l.liEl.classList.add('hidden');
    } else {
      matched++;
      if (l.titleEl) l.titleEl.innerHTML = highlight(l.titleEl.textContent, q);
      if (l.descEl && l.descEl.tagName === 'PRE') {
        l.descEl.innerHTML = highlight(l.rawDesc, q);
        l.descEl.style.display = 'block';
      }
    }
  });

  pruneAndExpand(ROOT_EL);
  setStats(`match: ${matched}`);
}

function pruneAndExpand(rootUl) {
  const lis = Array.from(rootUl.children);
  lis.forEach(li => {
    const childUl = li.querySelector(':scope > ul');
    if (!childUl) return;
    pruneAndExpand(childUl);
    const visible = Array.from(childUl.children).some(x => !x.classList.contains('hidden'));
    li.classList.toggle('hidden', !visible);
    if (visible) childUl.style.display = 'block';
  });
}

function highlight(text, q) {
  const src = text || '';
  const low = src.toLowerCase();
  let out = '';
  let i = 0;
  while (true) {
    const idx = low.indexOf(q, i);
    if (idx === -1) {
      out += escapeHtml(src.slice(i));
      break;
    }
    out += escapeHtml(src.slice(i, idx));
    out += `<mark>${escapeHtml(src.slice(idx, idx + q.length))}</mark>`;
    i = idx + q.length;
  }
  return out;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

