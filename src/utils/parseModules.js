// Splits raw PDF text into modules based on "Module X" headers.
// Anything before the first "Module 1" (cover page, scheme, admin info) is dropped.

export function parseModules(rawText) {
  const moduleRegex = /module\s*[-–:]?\s*(\d+)/gi;

  const matches = [...rawText.matchAll(moduleRegex)];

  if (matches.length === 0) {
    // No modules detected — fall back to treating everything as one block
    return { "Full Document": rawText.trim() };
  }

  const modules = {};

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];

    const moduleNumber = current[1];
    const startIndex = current.index;
    const endIndex = next ? next.index : rawText.length;

    const content = rawText.slice(startIndex, endIndex).trim();

    const key = `Module ${moduleNumber}`;

    // If the same module number appears more than once, merge the content
    modules[key] = modules[key] ? modules[key] + "\n\n" + content : content;
  }

  return modules;
}