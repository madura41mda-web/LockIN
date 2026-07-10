const TYPE_ORDER = [
  "Definition",
  "Formula",
  "Derivation",
  "FAQ",
  "OneLiner",
  "CommonMistake",
];

const TYPE_LABELS = {
  Definition: "Definitions",
  Formula: "Formulae",
  Derivation: "Derivations",
  FAQ: "FAQs",
  OneLiner: "One-liners",
  CommonMistake: "Common mistakes",
};

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => ({
      type: item?.type || "Revision Point",
      title: item?.title || item?.topic || `${item?.type || "Point"} ${index + 1}`,
      content: item?.content || item?.summary || item?.answer || "",
      page: item?.page,
    }))
    .filter((item) => item.title || item.content);
}

function groupByType(items) {
  return items.reduce((groups, item) => {
    if (!groups[item.type]) groups[item.type] = [];
    groups[item.type].push(item);
    return groups;
  }, {});
}

function sourceText(moduleName, page) {
  const parts = [];

  if (moduleName) parts.push(moduleName);
  if (page !== undefined && page !== null && String(page).trim() !== "") {
    const value = String(page).trim();
    parts.push(/^(page|slide)\s+/i.test(value) ? value : `Page ${value}`);
  }

  return parts.length > 0 ? parts.join(" - ") : "Source not available";
}

export default function QuickRevision({ items, moduleName }) {
  const revisionItems = normalizeItems(items);

  if (revisionItems.length === 0) return null;

  const grouped = groupByType(revisionItems);
  const orderedTypes = [
    ...TYPE_ORDER.filter((type) => grouped[type]),
    ...Object.keys(grouped).filter((type) => !TYPE_ORDER.includes(type)),
  ];

  return (
    <section className="revision-board">
      <header className="revision-header">
        <span className="setup-label">quick_revision</span>
        <h3 className="revision-heading">Quick Revision</h3>
        <p className="revision-subtitle">
          {moduleName ? `Generated from ${moduleName}` : "Generated from your notes"}
        </p>
      </header>

      {orderedTypes.map((type) => (
        <section key={type} className="revision-type-block">
          <div className="revision-type-header">
            <span className="setup-label">{TYPE_LABELS[type] || type}</span>
            <span className="revision-count">{grouped[type].length}</span>
          </div>

          <div className="revision-list">
            {grouped[type].map((item, index) => (
              <article key={`${type}-${index}`} className="revision-item">
                <p className="revision-title">{item.title}</p>

                {item.content && (
                  <p className="revision-content">
                    {item.content}
                  </p>
                )}

                <p className="revision-source">
                  Source: {sourceText(moduleName, item.page)}
                </p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
