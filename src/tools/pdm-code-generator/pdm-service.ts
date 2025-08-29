// 属性列表
const TBL_ATTR_LIST = ['Name', 'Code', 'CreationDate', 'Creator', 'ModificationDate', 'Modifier', 'PhysicalOptions'];
const COL_ATTR_LIST = ['Name', 'Code', 'CreationDate', 'Creator', 'ModificationDate', 'Modifier', 'DataType', 'Length', 'Column.Mandatory', 'Comment'];
const IDX_ATTR_LIST = ['Name', 'Code', 'CreationDate', 'Creator', 'ModificationDate', 'Modifier', 'PhysicalOptions', 'Unique'];
const IDXCOL_ATTR_LIST = ['CreationDate', 'Creator', 'ModificationDate', 'Modifier'];

function getNodesByPath(parent: Node, xmlPath: string): Node[] | Node {
  let curr: Node | null = parent;
  const parts = xmlPath.split('/');
  for (let i = 0; i < parts.length - 1; i++) {
    const [tag, idxStr] = parts[i].split('|'); const idx = idxStr ? Number.parseInt(idxStr) : 0;
    if (!curr) { return []; }
    const children: Node[] = Array.from(curr.childNodes).filter(n => n.nodeName === tag);
    if (children.length <= idx) { return []; }
    curr = children[idx];
  }
  const [tag, idxStr] = parts[parts.length - 1].split('|'); const idx = idxStr ? Number.parseInt(idxStr) : null;
  if (!curr) { return []; }
  const children = Array.from(curr.childNodes).filter(n => n.nodeName === tag);
  return idx === null ? children : (children[idx] || []);
}

function getAttrsByList(parent: Node, list: string[]) {
  const ret: Record<string, string> = {};
  for (const attr of list) {
    ret[attr] = '';
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeName === `a:${attr}` && child.firstChild) { ret[attr] = child.firstChild.nodeValue || ''; break; }
    }
  }
  return ret;
}

function getPkgnodesRecursively(o_pkg: Node): Node[] {
  if (o_pkg.nodeName !== 'o:Model' && o_pkg.nodeName !== 'o:Package') { return []; }
  let ret: Node[] = [];
  const subpkgs = getNodesByPath(o_pkg, 'c:Packages/o:Package');
  if (Array.isArray(subpkgs)) { for (const sub of subpkgs) { ret.push(sub); ret = ret.concat(getPkgnodesRecursively(sub)); } }
  return ret;
}

function getPkgNodes(hpdm: Document): Node[] {
  const o_mdl = (getNodesByPath(hpdm, 'Model/o:RootObject/c:Children/o:Model') as Node[])[0];
  return [o_mdl, ...getPkgnodesRecursively(o_mdl)];
}

function getIdxColAttrs(idxcol: Node) {
  const ret = getAttrsByList(idxcol, IDXCOL_ATTR_LIST);
  const refcol = getNodesByPath(idxcol, 'c:Column/o:Column');
  let refcolid = '';
  if (Array.isArray(refcol) && refcol.length > 0) { refcolid = (refcol[0] as Element).getAttribute('Ref') || ''; }
  else { ret['RefColCode'] = ''; return ret; }
  let curr: Node | null = idxcol;
  while (curr) {
    curr = curr.parentNode;
    if (!curr) { break; }
    if (curr.nodeName === 'o:Table') {
      for (const col of getNodesByPath(curr, 'c:Columns/o:Column') as Node[]) {
        if ((col as Element).getAttribute('Id') === refcolid) { ret['RefColCode'] = getAttrsByList(col, COL_ATTR_LIST)['Code']; }
      }
      break;
    }
  }
  return ret;
}

function getDiagramNodes(doc: Document) {
  return getNodesByPath(doc, 'Model/o:RootObject/c:Children/o:Model/c:PhysicalDiagrams/o:PhysicalDiagram') as Node[];
}

function getTablesInDiagram(diag: Node): string[] {
  const tblSymbols = getNodesByPath(diag, 'c:Symbols/o:TableSymbol') as Node[];
  const tblCodes: string[] = [];
  for (const sym of tblSymbols) {
    const obj = getNodesByPath(sym, 'c:Object/o:Table') as Node[];
    if (obj.length > 0) {
      const refid = (obj[0] as Element).getAttribute('Ref');
      if (refid) {
        let curr: Node | null = sym;
        while (curr && curr.nodeName !== '#document') {
          if (curr.nodeName === 'o:Model') {
            for (const t of getNodesByPath(curr, 'c:Tables/o:Table') as Node[]) {
              if ((t as Element).getAttribute('Id') === refid) { tblCodes.push(getAttrsByList(t, TBL_ATTR_LIST)['Code']); }
            }
            break;
          }
          curr = curr.parentNode;
        }
      }
    }
  }
  return tblCodes;
}

function getDefaultDiagramId(doc: Document): string {
  const defaultDiagramNode = getNodesByPath(doc, 'Model/o:RootObject/c:Children/o:Model/c:DefaultDiagram/o:PhysicalDiagram') as Node[];
  if (defaultDiagramNode.length > 0) {
    return (defaultDiagramNode[0] as Element).getAttribute('Ref') || '';
  }
  return '';
}

// ========== JSON 输出 ========== //
export function pdmToJson(pdmXmlString: string) {
  const doc = new DOMParser().parseFromString(pdmXmlString, 'text/xml');
  const defaultDiagramId = getDefaultDiagramId(doc);

  const diagrams = getDiagramNodes(doc).map((diag) => {
    const attrs = getAttrsByList(diag, ['Name', 'Code']);
    const diagramId = (diag as Element).getAttribute('Id') || '';
    return {
      name: attrs['Name'],
      code: attrs['Code'],
      tables: getTablesInDiagram(diag),
      default: diagramId === defaultDiagramId,
    };
  });

  const tables: any[] = [];
  for (const pkg of getPkgNodes(doc)) {
    for (const tbl of getNodesByPath(pkg, 'c:Tables/o:Table') as Node[]) {
      const tAttr = getAttrsByList(tbl, TBL_ATTR_LIST);
      const fields = (getNodesByPath(tbl, 'c:Columns/o:Column') as Node[]).map((col) => {
        const cAttr = getAttrsByList(col, COL_ATTR_LIST);
        return {
          name: cAttr['Name'],
          code: cAttr['Code'],
          dataType: cAttr['DataType'],
          length: cAttr['Length'] ? Number.parseInt(cAttr['Length'], 10) : null,
          mandatory: cAttr['Column.Mandatory'] === '1',
        };
      });
      const indexs = (getNodesByPath(tbl, 'c:Indexes/o:Index') as Node[]).map((idx) => {
        const iAttr = getAttrsByList(idx, IDX_ATTR_LIST);
        const fields = (getNodesByPath(idx, 'c:IndexColumns/o:IndexColumn') as Node[]).map((idxcol) => {
          const icAttr = getIdxColAttrs(idxcol);
          return { name: icAttr['RefColCode'], code: icAttr['RefColCode'] };
        });
        return { name: iAttr['Name'], code: iAttr['Code'], unique: iAttr['Unique'] === '1', fields };
      });
      tables.push({ name: tAttr['Name'], code: tAttr['Code'], fields, indexs });
    }
  }
  return { diagrams, tables };
}
