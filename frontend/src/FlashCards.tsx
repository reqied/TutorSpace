import { useEffect, useState } from "react";
import { Plus, X, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { api, send } from "./api";
import Content from "./Content";
import TextEditor from "./TextEditor";
function DeckEditor({ initial, onClose, onSaved }: any) {
  const [title, setTitle] = useState(initial?.title || ""),
    [section, setSection] = useState(initial?.section || ""),
    [description, setDescription] = useState(initial?.description || ""),
    [cards, setCards] = useState<any[]>(
      initial?.cards?.length
        ? initial.cards.map((c: any) => ({ ...c }))
        : [{ front: "", back: "" }],
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function move(n: number, to: number) {
    const copy = [...cards];
    [copy[n], copy[to]] = [copy[to], copy[n]];
    setCards(copy);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send(
        "/decks" + (initial ? "/" + initial.id : ""),
        { title, section, description, cards },
        initial ? "PUT" : "POST",
      );
      await onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="overlay">
      <form className="modal wide" onSubmit={save}>
        <div className="section-title">
          <h2>{initial ? "Редактировать набор" : "Новый набор карточек"}</h2>
          <button
            type="button"
            className="icon"
            disabled={busy}
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X />
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        <label>
          Название
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Раздел
          <input
            required
            value={section}
            onChange={(e) => setSection(e.target.value)}
          />
        </label>
        <TextEditor
          label="Описание"
          value={description}
          onChange={setDescription}
        />
        {cards.map((c, n) => (
          <section className="task-editor" key={c.id || "card" + n}>
            <div className="section-title">
              <b>Карточка {n + 1}</b>
              <div className="row">
                <button
                  type="button"
                  className="icon"
                  aria-label="Вверх"
                  disabled={n === 0}
                  onClick={() => move(n, n - 1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  className="icon"
                  aria-label="Вниз"
                  disabled={n === cards.length - 1}
                  onClick={() => move(n, n + 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  className="icon"
                  aria-label="Удалить карточку"
                  disabled={cards.length === 1}
                  onClick={() => setCards(cards.filter((_, i) => i !== n))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <TextEditor
              label="Лицевая сторона / Вопрос"
              value={c.front}
              onChange={(front) =>
                setCards(cards.map((x, i) => (i === n ? { ...x, front } : x)))
              }
              required
            />
            <TextEditor
              label="Оборот / Ответ"
              value={c.back}
              onChange={(back) =>
                setCards(cards.map((x, i) => (i === n ? { ...x, back } : x)))
              }
              required
            />
          </section>
        ))}
        <div className="row lower">
          <button
            type="button"
            className="outline"
            disabled={cards.length >= 200 || busy}
            onClick={() => setCards([...cards, { front: "", back: "" }])}
          >
            <Plus size={15} />
            Ещё карточка
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Сохранение…" : "Сохранить набор"}
          </button>
        </div>
      </form>
    </div>
  );
}
export default function FlashCards({ tutor, students, userId }: any) {
  const [decks, setDecks] = useState<any[]>([]),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<any>(undefined),
    [study, setStudy] = useState<any>(null),
    [queue, setQueue] = useState<string[]>([]),
    [index, setIndex] = useState(0),
    [flipped, setFlipped] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [filter, setFilter] = useState("");
  async function load() {
    setDecks(await api("/decks"));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function begin(d: any, repeat = false) {
    const subset = d.cards.filter(
      (c: any) =>
        !repeat ||
        !d.progress.some(
          (p: any) => p.studentId === userId && p.cardId === c.id && p.known,
        ),
    );
    setStudy(d.id);
    setQueue(subset.map((c: any) => c.id));
    setIndex(0);
    setFlipped(false);
  }
  const deck = decks.find((d) => d.id === study),
    card = deck?.cards.find((c: any) => c.id === queue[index]);
  async function rate(known: boolean) {
    await run(async () => {
      if (!tutor) {
        const p = await send("/cards/" + card.id + "/review", { known });
        setDecks((ds) =>
          ds.map((d) =>
            d.id === deck.id
              ? {
                  ...d,
                  progress: [
                    ...d.progress.filter(
                      (x: any) =>
                        !(x.cardId === card.id && x.studentId === userId),
                    ),
                    p,
                  ],
                }
              : d,
          ),
        );
      }
      setIndex((i) => i + 1);
      setFlipped(false);
    });
  }
  if (study && deck)
    return (
      <div className="flash-study">
        <div className="section-title">
          <button className="outline" onClick={() => setStudy(null)}>
            К наборам
          </button>
          <span className="status-text">
            {tutor
              ? "Предпросмотр без записи прогресса"
              : "Твой прогресс сохраняется"}
          </span>
        </div>
        <h2>{deck.title}</h2>
        {error && <div className="error">{error}</div>}
        {card ? (
          <>
            <div className="flash-progress">
              <span>
                Карточка {index + 1} / {queue.length}
              </span>
              <progress value={index} max={queue.length} />
            </div>
            <article className={"flash-face " + (flipped ? "flipped" : "")}>
              <span className="eyebrow">{flipped ? "ОТВЕТ" : "ВОПРОС"}</span>
              <Content text={flipped ? card.back : card.front} />
            </article>
            {!flipped ? (
              <button className="primary" onClick={() => setFlipped(true)}>
                Показать ответ
              </button>
            ) : (
              <div className="row flash-actions">
                <button
                  className="outline"
                  disabled={busy}
                  onClick={() => void rate(false)}
                >
                  Повторить
                </button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void rate(true)}
                >
                  Знаю
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="empty">
            <h2>
              {queue.length ? "Набор пройден" : "Все карточки уже знакомы"}
            </h2>
            <p>
              Можно повторить весь набор или только карточки без отметки «Знаю».
            </p>
            <div className="row flash-actions">
              <button className="outline" onClick={() => begin(deck, true)}>
                Повторить незнакомые
              </button>
              <button className="primary" onClick={() => begin(deck)}>
                Пройти снова
              </button>
            </div>
          </div>
        )}
      </div>
    );
  return (
    <>
      {error && <div className="error">{error}</div>}
      {notice && <div className="notice">{notice}</div>}
      <div className="toolbar">
        <input
          placeholder="Найти набор или раздел"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {tutor && (
          <button className="primary" onClick={() => setEditing(null)}>
            <Plus size={16} />
            Создать набор
          </button>
        )}
      </div>
      <div className="cards">
        {decks
          .filter((d) =>
            (d.title + d.section).toLowerCase().includes(filter.toLowerCase()),
          )
          .map((d, i) => (
            <article className="card resource" key={d.id}>
              <div className={"resource-cover cover" + (i % 3)}>
                <span>{d.section}</span>
                <b>Аа</b>
                <span className="deck-count">{d.cards.length} карточек</span>
              </div>
              <div className="resource-body">
                <h2>{d.title}</h2>
                <Content text={d.description} />
                {!tutor && (
                  <p>
                    Знаю:{" "}
                    {
                      d.progress.filter(
                        (p: any) =>
                          p.studentId === userId &&
                          p.known &&
                          d.cards.some((c: any) => c.id === p.cardId),
                      ).length
                    }{" "}
                    / {d.cards.length}
                  </p>
                )}
                <div className="row">
                  <button className="primary" onClick={() => begin(d)}>
                    Учить
                  </button>
                  {tutor ? (
                    <button className="outline" onClick={() => setEditing(d)}>
                      Изменить
                    </button>
                  ) : (
                    <button className="link" onClick={() => begin(d, true)}>
                      Повторить незнакомые
                    </button>
                  )}
                </div>
                {tutor && (
                  <>
                    <form
                      className="deck-assign"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void run(async () => {
                          await send("/decks/" + d.id + "/assign", {
                            studentId: f.get("studentId"),
                          });
                          await load();
                          setNotice("Набор назначен ученику");
                        });
                      }}
                    >
                      <select name="studentId" required>
                        <option value="">Выбрать ученика</option>
                        {students.map((s: any) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <button className="outline" disabled={busy}>
                        Назначить
                      </button>
                    </form>
                    <details className="deck-progress">
                      <summary>
                        Ученики и прогресс · {d.assignments.length}
                      </summary>
                      {d.assignments.map((a: any) => (
                        <p key={a.id}>
                          {
                            students.find((s: any) => s.id === a.studentId)
                              ?.name
                          }
                          :{" "}
                          {
                            d.progress.filter(
                              (p: any) =>
                                p.studentId === a.studentId &&
                                p.known &&
                                d.cards.some((c: any) => c.id === p.cardId),
                            ).length
                          }{" "}
                          / {d.cards.length} знакомых
                        </p>
                      ))}
                    </details>
                  </>
                )}
              </div>
            </article>
          ))}
      </div>
      {!decks.length && (
        <div className="empty">
          {tutor
            ? "Создай первый набор карточек."
            : "Репетитор ещё не назначил карточки."}
        </div>
      )}
      {editing !== undefined && (
        <DeckEditor
          initial={editing}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            await load();
            setEditing(undefined);
          }}
        />
      )}
    </>
  );
}
