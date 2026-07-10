export default function ModuleSelector({ modules, selectedModule, setSelectedModule }) {
  const moduleNames = Object.keys(modules);
  if (moduleNames.length === 0) return null;

  return (
    <div className="module-select-wrap mt-4">
      <label className="module-select-label">select_module</label>
      <select
        value={selectedModule}
        onChange={(e) => setSelectedModule(e.target.value)}
        className="module-select"
      >
        {moduleNames.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
        <option value="__ALL__">Entire Syllabus</option>
      </select>
    </div>
  );
}