let ROOT_EL = null;
let ALL_BRANCHES = []; // { childrenEl, twistyEl, isOpenFn, openFn, closeFn, labelEl }
let ALL_LEAFS = [];    // { liEl, text, linkEl, nameEl, urlEl }

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
  const expandAllBtn = document.getElementById('expandAll');
  const collapseAllBtn = document.getElementById('collapseAll');

  q.addEventListener('input', () => applySearch(q.value));
  expandAllBtn.addEventListener('click', () => expandAll());
  collapseAllBtn.addEventListener('click', () => collapseAll());
}

function setStats(extra = '') {
  const stats = document.getElementById('stats');
  const branches = ALL_BRANCHES.length;
  const leafs = ALL_LEAFS.length;
  stats.textContent = `${branches} kategorii, ${leafs} linków${extra ? ' • ' + extra : ''}`;
}

function renderNode(node) {
  const ul = document.createElement('ul');

  // Stabilna kolejność (opcjonalnie)
  const keys = Object.keys(node || {}).sort((a,b) => a.localeCompare(b, 'pl'));

  for (const key of keys) {
    const li = document.createElement('li');

    const val = node[key];

    if (Array.isArray(val)) {
      // "liście" w tej kategorii
      const header = document.createElement('div');
      header.innerHTML = `<span class="twisty"></span><span class="node">${escapeHtml(key)}</span>`;
      li.appendChild(header);

      const linksUl = document.createElement('ul');
      linksUl.className = 'children';

      val.forEach(item => {
        const linkLi = document.createElement('li');

        const name = (item?.name ?? '').toString();
        const url = (item?.url ?? '').toString();

        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = name || url || '(brak)';

        const urlSpan = document.createElement('span');
        urlSpan.className = 'muted';
        urlSpan.textContent = url && name ? `— ${url}` : '';

        linkLi.appendChild(a);
        linkLi.appendChild(urlSpan);

        ALL_LEAFS.push({
          liEl: linkLi,
          text: (name + ' ' + url).toLowerCase(),
          linkEl: a,
          nameEl: a,
          urlEl: urlSpan,
          rawName: name,
          rawUrl: url
        });

        linksUl.appendChild(linkLi);
      });

      li.appendChild(linksUl);

      // Ta "kategoria z listą" jest traktowana jako branch, żeby można było ją chować/pokazywać
      const branch = makeBranch(header, linksUl);
      ALL_BRANCHES.push(branch);

    } else if (val && typeof val === 'object') {
      // gałąź z podkategoriami
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
        children.style.display = children.style.display === 'none' ? 'block' : 'none';
        twisty.textContent = children.style.display === 'none' ? '▸' : '▾';
      });

      li.appendChild(header);
      li.appendChild(children);

      const branch = makeBranch(header, children, twisty, label);
      ALL_BRANCHES.push(branch);

    } else {
      // ignoruj śmieci / null
      continue;
    }

    ul.appendChild(li);
  }

  return ul;
}

function makeBranch(headerEl, childrenEl, twistyEl = null, labelEl = null) {
  // Jeśli nie ma twisty (w przypadku "kategoria z listą"), dodajmy je, żeby było spójnie
  if (!twistyEl) {
    twistyEl = headerEl.querySelector('.twisty');
    twistyEl.textContent = '▾'; // domyślnie otwarte dla listy linków
    // Klik do toggle
    headerEl.addEventListener('click', () => {
      childrenEl.style.display = childrenEl.style.display === 'none' ? 'block' : 'none';
      twistyEl.textContent = childrenEl.style.display === 'none' ? '▸' : '▾';
    });
  }

  const isOpenFn = () => childrenEl.style.display !== 'none';
  const openFn = () => { childrenEl.style.display = 'block'; twistyEl.textContent = '▾'; };
  const closeFn = () => { childrenEl.style.display = 'none'; twistyEl.textContent = '▸'; };

  return { headerEl, childrenEl, twistyEl, labelEl, isOpenFn, openFn, closeFn };
}

function expandAll() {
  ALL_BRANCHES.forEach(b => b.openFn());
  setStats('expanded');
}

function collapseAll() {
  ALL_BRANCHES.forEach(b => b.closeFn());
  setStats('collapsed');
}

function applySearch(query) {
  const q = (query || '').trim().toLowerCase();

  // reset widoczności + highlight dla liści
  ALL_LEAFS.forEach(l => {
    l.liEl.classList.remove('hidden');
    l.nameEl.innerHTML = escapeHtml(l.rawName || l.nameEl.textContent);
    l.urlEl.textContent = l.rawUrl && l.rawName ? `— ${l.rawUrl}` : '';
  });

  // reset dla kategorii (nagłówków gałęzi)
  ALL_BRANCHES.forEach(b => {
    // labelEl jest tylko dla gałęzi typu "object"; dla "kategorii z listą" label jest w .node
    const label = b.labelEl || b.headerEl.querySelector('.node');
    if (label) label.innerHTML = escapeHtml(label.textContent);
  });

  if (!q) {
    showAllBranches();
    setStats();
    return;
  }

  // 1) dopasowania liści (recordy)
  let matchedLeafs = 0;
  ALL_LEAFS.forEach(l => {
    const ok = l.text.includes(q);
    if (!ok) {
      l.liEl.classList.add('hidden');
    } else {
      matchedLeafs++;
      const name = l.rawName || '';
      const url = l.rawUrl || '';
      l.nameEl.innerHTML = highlight(name || url, q);
      if (l.rawUrl && l.rawName) {
        l.urlEl.innerHTML = `— ${highlight(url, q)}`;
      } else {
        l.urlEl.textContent = '';
      }
    }
  });

  // 2) dopasowania kategorii (nazwy węzłów)
  let matchedCats = 0;
  const matchedBranchHeaders = new Set(); // żeby nie liczyć 2x

  ALL_BRANCHES.forEach(b => {
    const label = b.labelEl || b.headerEl.querySelector('.node');
    if (!label) return;

    const raw = (label.textContent || '').toString();
    if (raw.toLowerCase().includes(q)) {
      matchedCats++;
      label.innerHTML = highlight(raw, q);
      matchedBranchHeaders.add(b.headerEl);
      // otwórz tę gałąź
      b.openFn();
    }
  });

  // 3) pruning: pokazujemy gałęzie jeśli:
  // - mają widoczne dopasowane liście, LUB
  // - same (albo któryś z ich potomków) mają nazwę kategorii dopasowaną
  pruneAndExpandWithCategoryMatches(ROOT_EL, matchedBranchHeaders);

  setStats(`linki: ${matchedLeafs}, kategorie: ${matchedCats}`);
}

function showAllBranches() {
  // pokazuje wszystkie listy / dzieci
  ALL_BRANCHES.forEach(b => b.childrenEl.classList.remove('hidden'));
  // pokazuje wszystkie li elementy gałęzi
  ROOT_EL.querySelectorAll('li').forEach(li => li.classList.remove('hidden'));

  // opcjonalnie: zostaw w stanie jak było, albo rozwiń wszystko.
  // Ja zostawiam jak było (brak zmiany).
}

function pruneAndExpand(rootUl) {
  // rekursywnie:
  // - jeśli li zawiera ul i w nim nic widocznego -> ukryj li
  // - jeśli w środku coś widocznego -> pokaż li i rozwiń gałąź
  const lis = Array.from(rootUl.children).filter(x => x.tagName === 'LI');

  lis.forEach(li => {
    const childUl = li.querySelector(':scope > ul');
    const childDiv = li.querySelector(':scope > div');

    if (childUl) {
      // przetnij najpierw w dół
      pruneAndExpand(childUl);

      const anyVisible = Array.from(childUl.querySelectorAll(':scope > li'))
        .some(x => !x.classList.contains('hidden'));

      if (!anyVisible) {
        li.classList.add('hidden');
      } else {
        li.classList.remove('hidden');
        // rozwiń gałąź jeśli ma twisty
        const twisty = childDiv?.querySelector('.twisty') || childDiv?.previousSibling?.querySelector?.('.twisty');
        if (twisty) {
          childUl.style.display = 'block';
          twisty.textContent = '▾';
        }
      }
    } else {
      // liść: już ustawiony wcześniej
      // jeśli hidden -> zostaje
    }
  });
}

function highlight(text, q) {
  if (!text) return '';
  const safe = escapeHtml(text);
  // proste, bez regex-escape chaosu: split/join na lower-case indeksach
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return safe;
  const before = escapeHtml(text.slice(0, idx));
  const mid = escapeHtml(text.slice(idx, idx + q.length));
  const after = escapeHtml(text.slice(idx + q.length));
  return `${before}<mark>${mid}</mark>${after}`;
}

function escapeHtml(s) {
  return (s ?? '').toString()
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

