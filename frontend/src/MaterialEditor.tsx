import { useState } from "react";
import { X, Plus, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { send } from "./api";
import TextEditor from "./TextEditor";
const blank = () => ({
  title: "",
  content: "",
  answer: "",
  solution: "",
  autoCheck: false,
});
export default function MaterialEditor({
  initial,
  materials,
  onClose,
  onSaved,
}: any) {
  const [title, setTitle] = useState(initial?.title || ""),
    [section, setSection] = useState(initial?.section || ""),
    [kind, setKind] = useState(initial?.kind || "Урок"),
    [content, setContent] = useState(initial?.content || ""),
    [tasks, setTasks] = useState<any[]>(
      initial?.tasks?.length
        ? initial.tasks.map((t: any) => ({ ...t }))
        : [blank()],
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [bank, setBank] = useState("");
  function change(index: number, patch: any) {
    setTasks((ts) => ts.map((t, n) => (n === index ? { ...t, ...patch } : t)));
  }
  function move(index: number, to: number) {
    if (to < 0 || to >= tasks.length) return;
    const copy = [...tasks];
    [copy[index], copy[to]] = [copy[to], copy[index]];
    setTasks(copy);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send(
        "/materials" + (initial ? "/" + initial.id : ""),
        {
          title,
          section,
          kind,
          content,
          tasks: tasks.map((t) => ({ ...t, title: t.title.trim() })),
        },
        initial ? "PUT" : "POST",
      );
      await onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const source = materials.flatMap((m: any) =>
    (m.tasks || []).map((t: any) => ({ ...t, materialTitle: m.title })),
  );
  return (
    <div className="overlay">
      <form className="modal wide" onSubmit={save}>
        <div className="section-title">
          <h2>{initial ? "Редактировать материал" : "Новый материал"}</h2>
          <button
            type="button"
            disabled={busy}
            className="icon"
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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
          />
        </label>
        <div className="row">
          <label>
            Раздел
            <input
              required
              value={section}
              onChange={(e) => setSection(e.target.value)}
            />
          </label>
          <label>
            Тип
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option>Урок</option>
              <option>Домашка</option>
            </select>
          </label>
        </div>
        <TextEditor
          label="Введение и теория"
          value={content}
          onChange={setContent}
        />
        <div className="section-title lower">
          <h2>Задания · {tasks.length}</h2>
          <button
            type="button"
            className="outline"
            disabled={tasks.length >= 100}
            onClick={() => setTasks([...tasks, blank()])}
          >
            <Plus size={15} />
            Добавить
          </button>
        </div>
        {tasks.map((t, index) => (
          <section className="task-editor" key={t.id || "new-" + index}>
            <div className="section-title">
              <b>Задание {index + 1}</b>
              <div className="row">
                <button
                  type="button"
                  className="icon"
                  aria-label="Вверх"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  className="icon"
                  aria-label="Вниз"
                  disabled={index === tasks.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  className="icon"
                  aria-label="Удалить задание"
                  onClick={() => setTasks(tasks.filter((_, n) => n !== index))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <label>
              Название задания
              <input
                required
                value={t.title}
                onChange={(e) => change(index, { title: e.target.value })}
                maxLength={200}
                placeholder="Например, перевод числа в двоичную систему"
              />
            </label>
            <TextEditor
              label="Условие задания"
              value={t.content}
              onChange={(content) => change(index, { content })}
            />
            <div className="teacher-fields">
              <span className="tag">Только репетитору</span>
              <label>
                Правильный ответ
                <input
                  value={t.answer}
                  onChange={(e) => change(index, { answer: e.target.value })}
                  maxLength={5000}
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={t.autoCheck}
                  onChange={(e) =>
                    change(index, { autoCheck: e.target.checked })
                  }
                />
                Автопроверка короткого ответа
              </label>
              <TextEditor
                label="Подробное решение"
                value={t.solution}
                onChange={(solution) => change(index, { solution })}
              />
            </div>
          </section>
        ))}
        {source.length > 0 && (
          <div className="bank-picker">
            <label>
              Скопировать задание из библиотеки
              <select value={bank} onChange={(e) => setBank(e.target.value)}>
                <option value="">Выбрать задание</option>
                {source.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.materialTitle} / {t.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="outline"
              disabled={!bank || tasks.length >= 100}
              onClick={() => {
                const t = source.find((t: any) => t.id === bank);
                if (t) {
                  const { id, materialTitle, ...copy } = t;
                  setTasks([...tasks, copy]);
                  setBank("");
                }
              }}
            >
              Добавить копию
            </button>
          </div>
        )}
        <p className="footnote">
          Ответ и решение не передаются ученику. Для программного кода оставляй
          ручную проверку. Удалённые задания скрываются, старые ответы
          сохраняются в базе.
        </p>
        <button className="primary" disabled={busy}>
          {busy ? "Сохранение…" : "Сохранить материал"}
        </button>
      </form>
    </div>
  );
}
