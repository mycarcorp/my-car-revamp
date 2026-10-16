import { parseFragment, serialize, type DefaultTreeAdapterTypes } from "parse5";

type Parent = DefaultTreeAdapterTypes.ParentNode;
type Element = DefaultTreeAdapterTypes.Element;
const isElement = (node: DefaultTreeAdapterTypes.ChildNode): node is Element => "tagName" in node;

/** Repair pasted-document list items without dropping content, attributes, or nested lists. */
export function normalizeArticleLists(html: string): string {
  const fragment = parseFragment(html);
  const visit = (parent: Parent) => {
    const children = [...parent.childNodes];
    parent.childNodes = [];
    let list: Element | null = null;
    for (const child of children) {
      const parentIsList = "tagName" in parent && (parent.tagName === "ul" || parent.tagName === "ol");
      if (isElement(child) && child.tagName === "li" && !parentIsList) {
        if (!list) {
          list = { nodeName: "ul", tagName: "ul", attrs: [], namespaceURI: child.namespaceURI, childNodes: [], parentNode: parent };
          parent.childNodes.push(list);
        }
        child.parentNode = list;
        list.childNodes.push(child);
      } else {
        list = null;
        if (parentIsList && !(isElement(child) && child.tagName === "li") && !(child.nodeName === "#text" && "value" in child && !child.value.trim()) && child.nodeName !== "#comment") {
          const item: Element = { nodeName: "li", tagName: "li", attrs: [], namespaceURI: (parent as Element).namespaceURI, childNodes: [child], parentNode: parent };
          child.parentNode = item;
          parent.childNodes.push(item);
        } else {
          child.parentNode = parent;
          parent.childNodes.push(child);
        }
      }
      if (isElement(child)) visit(child);
    }
  };
  visit(fragment);
  return serialize(fragment);
}