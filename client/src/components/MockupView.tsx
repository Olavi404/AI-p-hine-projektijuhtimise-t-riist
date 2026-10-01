// Mockup'i kuvamine komponentide loendist. AI tagastab ainult andmed (JSON), mitte HTML-i ega koodi:
// kõik tekstid renderdab React tekstina, seega brauseris ei käivitu AI loodud kood.
import type { MockupElement, MockupSpec } from "../../../shared/types.ts";

interface Props {
  spec: MockupSpec;
  /** Esiletõstetud elemendid (nt kriteeriumile osutades). */
  highlight?: string[];
  /** Võrdlusversioon: muutunud ja uued elemendid märgitakse. */
  compareTo?: MockupSpec | null;
  compact?: boolean;
  /** Elemendile osutamisel teatatakse selle id (et esile tõsta seotud kriteeriumid). */
  onHover?: (id: string | null) => void;
}

export function MockupView({ spec, highlight = [], compareTo, compact, onHover }: Props) {
  const before = new Map<string, string>();
  compareTo?.sections.forEach((s) => s.elements.forEach((e) => before.set(e.id, JSON.stringify(e))));
  const status = (e: MockupElement) => {
    if (!compareTo) return "";
    const prev = before.get(e.id);
    if (prev === undefined) return " added";
    return prev !== JSON.stringify(e) ? " changed" : "";
  };

  return (
    <div className={`mockup${compact ? " compact" : ""}${onHover ? " linkable" : ""}${highlight.length ? " has-hl" : ""}`} aria-label={`Mockup: ${spec.title}`}>
      <div className="mockup-chrome">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
        <span className="mockup-title">{spec.title}</span>
      </div>
      <div className="mockup-body">
        {spec.sections.map((s) => (
          <section key={s.id} className={`mk-section layout-${s.layout}`}>
            {s.heading && <h4 className="mk-section-heading">{s.heading}</h4>}
            <div className="mk-elements">
              {s.elements.map((e) => (
                <div key={e.id} className={`mk-el mk-${e.type}${highlight.includes(e.id) ? " hl" : ""}${status(e)}`} data-el={e.id} title={e.id} onMouseEnter={onHover ? () => onHover(e.id) : undefined} onMouseLeave={onHover ? () => onHover(null) : undefined}>
                  <ElementBody el={e} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ElementBody({ el }: { el: MockupElement }) {
  switch (el.type) {
    case "nav":
      return (
        <>
          <strong>{el.label}</strong>
          <span className="mk-nav-items">
            {el.items.map((i, k) => (
              <span key={k}>{i}</span>
            ))}
          </span>
        </>
      );
    case "heading":
      return <h3>{el.label}</h3>;
    case "image":
      return <div className="mk-img">🖼 {el.label}</div>;
    case "button":
      return <span className="mk-btn">{el.label}</span>;
    case "link":
      return <span className="mk-link">{el.label}</span>;
    case "input":
      return (
        <label className="mk-field">
          <span>{el.label}</span>
          <span className="mk-input">{el.detail}</span>
        </label>
      );
    case "select":
      return (
        <label className="mk-field">
          <span>{el.label}</span>
          <span className="mk-input">{el.items[0] ?? el.detail} ▾</span>
        </label>
      );
    case "checkbox":
      return (
        <span>
          ☐ {el.label}
          {el.detail && <small> {el.detail}</small>}
        </span>
      );
    case "list":
      return (
        <div>
          {el.label && <strong>{el.label}</strong>}
          <ul>
            {el.items.map((i, k) => (
              <li key={k}>{i}</li>
            ))}
          </ul>
        </div>
      );
    case "table":
      return (
        <div>
          {el.label && <strong>{el.label}</strong>}
          <div className="mk-table">
            {el.items.map((i, k) => (
              <span key={k}>{i}</span>
            ))}
          </div>
        </div>
      );
    case "card":
      return (
        <div>
          <strong>{el.label}</strong>
          {el.detail && <p>{el.detail}</p>}
          {el.items.length > 0 && (
            <ul>
              {el.items.map((i, k) => (
                <li key={k}>{i}</li>
              ))}
            </ul>
          )}
        </div>
      );
    case "price":
      return (
        <div>
          <span className="mk-price">{el.label}</span>
          {el.detail && <small className="mk-price-note">{el.detail}</small>}
        </div>
      );
    case "badge":
      return <span className="mk-badge">{el.label}</span>;
    case "notice":
      return (
        <div>
          ✓ {el.label}
          {el.detail && <small> – {el.detail}</small>}
        </div>
      );
    default:
      return (
        <div>
          {el.label}
          {el.detail && <small> {el.detail}</small>}
        </div>
      );
  }
}
