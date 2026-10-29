/** Use text nodes for provider-sourced names; never interpolate them into HTML. */
export function createStationPin(id: string, name: string): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button'; element.dataset.stationId = id;
  element.setAttribute('aria-label', `${name} · ID ${id}`);
  const symbol = document.createElement('span');
  symbol.className = 'map-pin-symbol'; symbol.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'map-pin-label'; label.setAttribute('aria-hidden', 'true'); label.textContent = name;
  element.append(symbol, label); updateStationPin(element, false);
  return element;
}
export function updateStationPin(element: HTMLButtonElement, selected: boolean): void {
  element.className = selected ? 'map-pin map-pin-selected' : 'map-pin';
  element.setAttribute('aria-pressed', String(selected));
  const symbol = element.querySelector('.map-pin-symbol');
  if (symbol) symbol.textContent = selected ? '✓' : '●';
}
