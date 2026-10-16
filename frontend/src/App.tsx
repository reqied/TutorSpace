import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CalendarDays,
  PenLine,
  Bell,
  ArrowUpRight,
  Plus,
  Search,
  ChevronRight,
  X,
  FileText,
} from "lucide-react";
import { api, send } from "./api";
import Board from "./Board";
import Content from "./Content";
import MaterialEditor from "./MaterialEditor";
import TaskList from "./TaskList";
import FlashCards from "./FlashCards";
const menu = [
  ["Обзор", LayoutDashboard],
  ["Ученики", Users],
  ["Расписание", CalendarDays],
  ["Библиотека", BookOpen],
  ["Задания", FileText],
  ["Карточки", BookOpen],
  ["Доска", PenLine],
  ["Уведомления", Bell],
] as const;
const fmt = (value: string) =>
  new Date(value).toLocaleString("ru-RU", {
    timeZone: "Asia/Yekaterinburg",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
function localValue(value?: string) {
  if (!value) return "";
  const d = new Date(new Date(value).getTime() + 5 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}
export default function App() {
  const [user, setUser] = useState<any>(null),
    [boot, setBoot] = useState(true),
    [page, setPage] = useState("Обзор"),
    [students, setStudents] = useState<any[]>([]),
    [lessons, setLessons] = useState<any[]>([]),
    [materials, setMaterials] = useState<any[]>([]),
    [assignments, setAssignments] = useState<any[]>([]),
    [notifications, setNotifications] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState(""),
    [editing, setEditing] = useState<any>(null),
    [reader, setReader] = useState<any>(null),
    [files, setFiles] = useState<any[]>([]),
    [preview, setPreview] = useState<any>(null),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("Все"),
    [currentAssignment, setCurrentAssignment] = useState<any>(null);
  const tutor = user?.role === "Tutor";
  const student = (id: string) => students.find((s) => s.id === id);
  const material = (id: string) => materials.find((s) => s.id === id);
  async function refresh(me = user) {
    const [s, l, m, a] = await Promise.all([
      api("/students"),
      api("/lessons"),
      api("/materials"),
      api("/assignments"),
    ]);
    setStudents(s);
    setLessons(l);
    setMaterials(m);
    setAssignments(a);
    if (me?.role === "Tutor") setNotifications(await api("/notifications"));
  }
  useEffect(() => {
    api("/auth/me")
      .then(async (me) => {
        setUser(me);
        await refresh(me);
      })
      .catch((e: any) => {
        if (e.message !== "Нужен вход") setError(e.message);
      })
      .finally(() => setBoot(false));
  }, []);
  async function action(fn: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function go(p: string) {
    setPage(p);
    setQuery("");
    setFilter("Все");
  }
  function create(type: string, item: any = null) {
    setError("");
    setEditing(item);
    setModal(type);
  }
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await action(async () => {
      const me = await send("/auth/login", {
        email: f.get("email"),
        password: f.get("password"),
      });
      setUser(me);
      await refresh(me);
    });
  }
  async function openMaterial(m: any, a: any = null) {
    await action(async () => {
      setFiles(await api("/files?materialId=" + m.id));
      setReader(m);
      setCurrentAssignment(a);
      setPreview(null);
    });
  }
  async function submitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      v = (k: string) => String(f.get(k) || "");
    await action(async () => {
      if (modal === "Ученик") {
        const body = {
          name: v("name"),
          email: v("email"),
          grade: v("grade"),
          password: v("password"),
          telegramChatId: v("telegramChatId") || null,
          vkPeerId: v("vkPeerId") || null,
        };
        await send(
          "/students" + (editing ? "/" + editing.id : ""),
          body,
          editing ? "PUT" : "POST",
        );
      }
      if (modal === "Занятие") {
        const body = {
          studentId: v("studentId") || editing?.studentId,
          title: v("title"),
          startsAt: v("startsAt") + ":00+05:00",
          minutes: +v("minutes"),
          price: +v("price"),
          done: editing?.done || false,
          paid: editing?.paid || false,
          materialId: v("lessonMaterialId") || null,
        };
        await send(
          "/lessons" + (editing ? "/" + editing.id : ""),
          body,
          editing ? "PATCH" : "POST",
        );
      }
      if (modal === "Назначить") {
        await send("/assignments", {
          studentId: v("studentId"),
          materialId: v("materialId"),
          deadline: v("deadline") + ":00+05:00",
        });
      }
      if (modal === "Проверить") {
        await send(
          "/assignments/" +
            editing.id +
            (editing.taskId ? "/tasks/" + editing.taskId : "") +
            "/review",
          {
            status: v("status"),
            feedback: v("feedback"),
          },
        );
      }
      setModal("");
      setEditing(null);
      await refresh();
    });
  }
  async function toggle(l: any, key: string) {
    await action(async () => {
      await send("/lessons/" + l.id, { ...l, [key]: !l[key] }, "PATCH");
      await refresh();
    });
  }
  if (boot) return <div className="login">Загрузка кабинета…</div>;
  if (!user)
    return (
      <div className="login">
        <form onSubmit={login}>
          <a className="brand">
            <span className="brandmark">т.</span>точка /
          </a>
          <h1>Рада видеть тебя.</h1>
          <p>Всё для занятий — в одном месте.</p>
          {error && <div className="error">{error}</div>}
          <label>
            Email
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Пароль
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button disabled={busy} className="primary">
            {busy ? "Вход…" : "Войти в кабинет"}
          </button>
          <p className="footnote">Ученику доступ выдаёт репетитор.</p>
        </form>
      </div>
    );
  function lessonRows(rows: any[]) {
    return rows.map((l) => (
      <tr key={l.id}>
        <td>
          <b>{fmt(l.startsAt)}</b>
          <small>
            {l.minutes} минут · {l.price} ₽
          </small>
        </td>
        <td>
          <b>{student(l.studentId)?.name}</b>
          <small>{l.title}</small>
          {l.materialId && material(l.materialId) && (
            <button
              className="link"
              onClick={() => void openMaterial(material(l.materialId))}
            >
              Открыть урок
            </button>
          )}
        </td>
        <td>
          <button
            disabled={!tutor || busy}
            className={"tag " + (l.done ? "success" : "")}
            onClick={() => void toggle(l, "done")}
          >
            {l.done ? "Проведено" : "Запланировано"}
          </button>
        </td>
        <td>
          <button
            disabled={!tutor || busy}
            className={"tag " + (l.paid ? "success" : "warm")}
            onClick={() => void toggle(l, "paid")}
          >
            {l.paid ? "Оплачено" : "Не оплачено"}
          </button>
        </td>
        {tutor && (
          <td>
            <button className="link" onClick={() => create("Занятие", l)}>
              Изменить
            </button>
          </td>
        )}
      </tr>
    ));
  }
  return (
    <div className="shell">
      <aside>
        <a className="brand" onClick={() => go("Обзор")}>
          <span className="brandmark">т.</span>точка
          <span className="branddot">/</span>
        </a>
        <div className="workspace">
          {tutor ? "КАБИНЕТ РЕПЕТИТОРА" : "КАБИНЕТ УЧЕНИКА"}
        </div>
        <nav>
          {menu
            .filter(([n]) => tutor || !["Ученики", "Уведомления"].includes(n))
            .map(([n, Icon]) => (
              <button
                key={n}
                className={page === n ? "active" : ""}
                onClick={() => go(n)}
              >
                <Icon size={19} />
                {n}
                {n === "Ученики" && <small>{students.length}</small>}
              </button>
            ))}
        </nav>
        <div className="aside-bottom">
          <div className="mini-note">
            Место для больших
            <br />
            маленьких побед.
            <div className="note-art">
              a² + b²
              <br />
              <i>= c²</i>
            </div>
          </div>
          <div className="profile">
            <div className="avatar">{user.name?.slice(0, 1)}</div>
            <div>
              <b>{user.name}</b>
              <small>{tutor ? "Репетитор" : "Ученик"}</small>
            </div>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <div className="crumb">
            Моё пространство <ChevronRight size={13} />
            {page}
          </div>
          <div className="head-right">
            <span className="save">
              <i />
              {busy ? "Сохранение…" : "Данные на сервере"}
            </span>
            <button
              className="outline"
              onClick={() => void action(() => refresh())}
            >
              Обновить
            </button>
            <button
              className="logout"
              onClick={() =>
                void action(async () => {
                  await send("/auth/logout", {});
                  setUser(null);
                  setStudents([]);
                  setMaterials([]);
                  setReader(null);
                  setPage("Обзор");
                })
              }
            >
              Выйти
            </button>
          </div>
        </header>
        <div className="content">
          {error && (
            <div className="error">
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Закрыть">
                <X size={16} />
              </button>
            </div>
          )}
          <div className="eyebrow">
            {tutor
              ? "ПРОСТРАНСТВО РЕПЕТИТОРА"
              : "ТВОЁ ПРОСТРАНСТВО ДЛЯ ОБУЧЕНИЯ"}
          </div>
          <div className="title-row">
            <h1>{page === "Обзор" ? "Всё начинается с урока." : page}</h1>
            {tutor && page !== "Карточки" && (
              <button
                disabled={busy}
                className="primary"
                onClick={() =>
                  create(
                    page === "Ученики"
                      ? "Ученик"
                      : page === "Библиотека"
                        ? "Материал"
                        : page === "Задания"
                          ? "Назначить"
                          : "Занятие",
                  )
                }
              >
                <Plus size={17} />
                {page === "Ученики"
                  ? "Добавить ученика"
                  : page === "Библиотека"
                    ? "Создать материал"
                    : page === "Задания"
                      ? "Назначить задание"
                      : "Запланировать урок"}
              </button>
            )}
          </div>
          <p className="subtitle">
            {page === "Библиотека"
              ? "Создавай один раз. Назначай любому ученику."
              : page === "Доска"
                ? "Решайте вместе и возвращайтесь к записям."
                : "Ученики, планы и маленькие победы — в одном месте."}
          </p>
          {page === "Обзор" && (
            <>
              <div className="stats">
                <div>
                  <span>{tutor ? "Мои ученики" : "Мои материалы"}</span>
                  <b>
                    {String(
                      tutor ? students.length : materials.length,
                    ).padStart(2, "0")}
                  </b>
                  <small>
                    У каждого свой путь <Users size={20} />
                  </small>
                </div>
                <div>
                  <span>Занятия впереди</span>
                  <b>
                    {String(lessons.filter((l) => !l.done).length).padStart(
                      2,
                      "0",
                    )}
                  </b>
                  <small>
                    Время для новых знаний <CalendarDays size={20} />
                  </small>
                </div>
                <div>
                  <span>Задания в работе</span>
                  <b>
                    {String(
                      assignments.filter(
                        (a) => !["Верно", "Принято"].includes(a.status),
                      ).length,
                    ).padStart(2, "0")}
                  </b>
                  <small>
                    Шаг за шагом к результату <BookOpen size={20} />
                  </small>
                </div>
                <div className="green-stat">
                  <span>Проведено занятий</span>
                  <b>
                    {String(lessons.filter((l) => l.done).length).padStart(
                      2,
                      "0",
                    )}
                  </b>
                  <small>
                    И это только начало <ArrowUpRight size={20} />
                  </small>
                </div>
              </div>
              <div className="dashboard-grid">
                <section>
                  <div className="section-title">
                    <h2>Ближайшие занятия</h2>
                    <button className="link" onClick={() => go("Расписание")}>
                      Всё расписание <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {lessons.some((l) => !l.done) ? (
                    <div className="lesson-list">
                      {lessons
                        .filter((l) => !l.done)
                        .slice(0, 5)
                        .map((l) => (
                          <div key={l.id} className="lesson-row">
                            <div className="time">
                              {new Date(l.startsAt).toLocaleTimeString(
                                "ru-RU",
                                {
                                  timeZone: "Asia/Yekaterinburg",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                              <small>{fmt(l.startsAt).split(",")[0]}</small>
                            </div>
                            <div className="vertical" />
                            <div className="avatar">
                              {student(l.studentId)?.name[0]}
                            </div>
                            <div className="lesson-info">
                              <b>{student(l.studentId)?.name}</b>
                              <small>{l.title}</small>
                              {l.materialId && material(l.materialId) && (
                                <button
                                  className="link"
                                  onClick={() =>
                                    void openMaterial(material(l.materialId))
                                  }
                                >
                                  Открыть урок
                                </button>
                              )}
                            </div>
                            <span
                              className={"tag " + (l.paid ? "success" : "warm")}
                            >
                              {l.paid ? "Оплачено" : "Ждёт оплаты"}
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="empty">
                      Пока нет занятий.{" "}
                      {tutor
                        ? "Запланируй первый урок."
                        : "Репетитор добавит расписание."}
                    </div>
                  )}
                  <div className="section-title lower">
                    <h2>Последние задания</h2>
                    <button className="link" onClick={() => go("Задания")}>
                      Все задания <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {assignments
                    .slice(-3)
                    .reverse()
                    .map((a) => (
                      <article
                        key={a.id}
                        className="card"
                        style={{ marginBottom: 12 }}
                      >
                        <div className="row">
                          <b>{material(a.materialId)?.title}</b>
                          <span className="tag">{a.status}</span>
                        </div>
                        <p>
                          {tutor ? student(a.studentId)?.name : "Срок"} ·{" "}
                          {fmt(a.deadline)}
                        </p>
                        <button
                          className="link"
                          onClick={() =>
                            void openMaterial(material(a.materialId), a)
                          }
                        >
                          Открыть <ArrowUpRight size={15} />
                        </button>
                      </article>
                    ))}
                </section>
                <section>
                  <div className="creative">
                    <span className="tag">ТВОЯ БИБЛИОТЕКА</span>
                    <h2>
                      Хороший урок
                      <br />
                      начинается с идеи.
                    </h2>
                    <p>
                      Материалы, к которым
                      <br />
                      захочется вернуться.
                    </p>
                    <div className="paper-art">
                      <div className="paper one">
                        x + y = ?<hr />
                        <hr />
                        <hr />
                      </div>
                      <div className="paper two">
                        <span>Аа</span>
                        <hr />
                        <hr />
                      </div>
                    </div>
                    <button
                      className="outline"
                      onClick={() => go("Библиотека")}
                    >
                      К материалам <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <div className="board-teaser">
                    <PenLine />
                    <h3>Место для мыслей</h3>
                    <p>Чистый лист для совместных открытий.</p>
                    <button className="link" onClick={() => go("Доска")}>
                      Открыть доску <ArrowUpRight size={15} />
                    </button>
                  </div>
                </section>
              </div>
            </>
          )}
          {page === "Ученики" && (
            <>
              <div className="toolbar">
                <label className="search">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Найти ученика"
                  />
                </label>
                <span>{students.length} учеников</span>
              </div>
              <div className="cards">
                {students
                  .filter((s) =>
                    (s.name + s.email)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((s, i) => (
                    <article className="card" key={s.id}>
                      <div
                        className="avatar large"
                        style={{
                          background: ["#e3edce", "#e6dff6", "#ffe5d3"][i % 3],
                        }}
                      >
                        {s.name
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")}
                      </div>
                      <h2>{s.name}</h2>
                      <p>
                        {s.grade}
                        <br />
                        {s.email}
                      </p>
                      <div className="card-meta">
                        {
                          lessons.filter((l) => l.studentId === s.id && l.done)
                            .length
                        }{" "}
                        занятий проведено
                        <br />
                        {lessons
                          .filter((l) => l.studentId === s.id && !l.paid)
                          .reduce((n, l) => n + l.price, 0)}{" "}
                        ₽ ожидают оплаты
                      </div>
                      <button
                        className="outline"
                        onClick={() => create("Ученик", s)}
                      >
                        Профиль и контакты
                      </button>
                      <button
                        className="link"
                        onClick={() => create("Назначить", { studentId: s.id })}
                      >
                        Назначить материал <ArrowUpRight size={15} />
                      </button>
                    </article>
                  ))}
              </div>
              {!students.length && (
                <div className="empty">
                  Добавь первого ученика и задай ему email и пароль для входа.
                </div>
              )}
            </>
          )}
          {page === "Расписание" && (
            <>
              <div className="toolbar">
                <div className="tabs">
                  {["Все", "Предстоят", "Проведены"].map((x) => (
                    <button
                      key={x}
                      className={filter === x ? "chosen" : ""}
                      onClick={() => setFilter(x)}
                    >
                      {x}
                    </button>
                  ))}
                </div>
                <span>Время: Екатеринбург (UTC+5)</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Дата / Стоимость</th>
                      <th>Ученик / Тема</th>
                      <th>Занятие</th>
                      <th>Оплата</th>
                      {tutor && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {lessonRows(
                      lessons.filter(
                        (l) =>
                          filter === "Все" ||
                          (filter === "Проведены" ? l.done : !l.done),
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {page === "Библиотека" && (
            <>
              <div className="toolbar">
                <div className="tabs">
                  {["Все", "Урок", "Домашка"].map((x) => (
                    <button
                      key={x}
                      className={filter === x ? "chosen" : ""}
                      onClick={() => setFilter(x)}
                    >
                      {x}
                    </button>
                  ))}
                </div>
                <label className="search">
                  <Search size={16} />
                  <input
                    placeholder="Название или раздел"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <div className="cards">
                {materials
                  .filter(
                    (m) =>
                      (filter === "Все" || m.kind === filter) &&
                      (m.title + m.section)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                  )
                  .map((m, i) => (
                    <article key={m.id} className="card resource">
                      <div className={"resource-cover cover" + (i % 3)}>
                        <span>{m.section}</span>
                        <b>
                          {i % 3 === 0 ? "ƒ(x)" : i % 3 === 1 ? "01" : "a + b"}
                        </b>
                        <BookOpen size={26} />
                      </div>
                      <div className="resource-body">
                        <span className="tag">
                          {m.kind}
                          {m.autoCheck ? " · Автопроверка" : ""}
                        </span>
                        <h2>{m.title}</h2>
                        <p>
                          {m.section} · {m.tasks?.length || 0} заданий
                        </p>
                        <div className="row">
                          <button
                            className="link"
                            onClick={() => void openMaterial(m)}
                          >
                            Открыть <ArrowUpRight size={15} />
                          </button>
                          {tutor && (
                            <button
                              className="outline"
                              onClick={() =>
                                create("Назначить", { materialId: m.id })
                              }
                            >
                              Назначить
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
              {!materials.length && (
                <div className="empty">
                  {tutor
                    ? "Создай урок или домашнее задание."
                    : "Здесь появятся назначенные материалы."}
                </div>
              )}
            </>
          )}
          {page === "Задания" && (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {tutor && <th>Ученик</th>}
                      <th>Материал</th>
                      <th>Срок</th>
                      <th>Статус</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a) => (
                      <tr key={a.id}>
                        {tutor && <td>{student(a.studentId)?.name}</td>}
                        <td>
                          <b>{material(a.materialId)?.title}</b>
                          <small>{material(a.materialId)?.kind}</small>
                        </td>
                        <td>{fmt(a.deadline)}</td>
                        <td>
                          <span
                            className={
                              "tag " +
                              (["Верно", "Принято"].includes(a.status)
                                ? "success"
                                : "")
                            }
                          >
                            {a.status}
                          </span>
                        </td>
                        <td>
                          <button
                            className="link"
                            onClick={() =>
                              void openMaterial(material(a.materialId), a)
                            }
                          >
                            Открыть
                          </button>
                          {tutor && (a.response || a.responses?.length > 0) && (
                            <button
                              className="outline"
                              onClick={() =>
                                void openMaterial(material(a.materialId), a)
                              }
                            >
                              Проверить
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!assignments.length && (
                <div className="empty">Назначений пока нет.</div>
              )}
            </>
          )}
          {page === "Карточки" && (
            <FlashCards tutor={tutor} students={students} userId={user.id} />
          )}
          {page === "Доска" && <Board lessons={lessons} students={students} />}
          {page === "Уведомления" && (
            <>
              <div className="notice">
                <Bell size={25} />
                <div>
                  <h3>Telegram и ВКонтакте</h3>
                  <p>
                    События: новое занятие, материал, результат проверки и
                    напоминание за час до урока.
                  </p>
                  <small>
                    Токены задаются на сервере в .env, chat_id / peer_id — в
                    профиле ученика. Без них очередь ждёт подключения. Отправки
                    проверяются каждые 30 секунд.
                  </small>
                </div>
              </div>
              <div className="table-wrap lower">
                <table>
                  <thead>
                    <tr>
                      <th>Создано</th>
                      <th>Сообщение</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.map((n) => (
                      <tr key={n.id}>
                        <td>{fmt(n.createdAt)}</td>
                        <td>
                          {n.text}
                          <small>{student(n.studentId)?.name}</small>
                        </td>
                        <td>
                          <span className="tag">{n.state}</span>
                          <small>
                            TG: {n.telegramState} · VK: {n.vkState}
                            <br />
                            Попыток: {n.attempts}
                          </small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <footer>
            <span>точка / пространство для обучения</span>
            <span>Маленькие шаги. Большие результаты.</span>
          </footer>
        </div>
      </main>
      {modal === "Материал" && (
        <MaterialEditor
          initial={editing}
          materials={materials}
          onClose={() => setModal("")}
          onSaved={async () => {
            await refresh();
            setModal("");
            setEditing(null);
          }}
        />
      )}
      {modal && modal !== "Материал" && (
        <div className="overlay">
          <form className="modal" onSubmit={submitForm}>
            {error && <div className="error">{error}</div>}
            <div className="section-title">
              <h2>
                {modal === "Ученик"
                  ? editing
                    ? "Профиль ученика"
                    : "Новый ученик"
                  : modal === "Занятие"
                    ? "Занятие"
                    : modal === "Проверить"
                      ? "Проверка задания"
                      : "Назначить материал"}
              </h2>
              <button
                type="button"
                className="icon"
                aria-label="Закрыть"
                onClick={() => setModal("")}
              >
                <X />
              </button>
            </div>
            {modal === "Ученик" ? (
              <>
                <label>
                  Имя
                  <input
                    name="name"
                    defaultValue={editing?.name}
                    required
                    maxLength={150}
                  />
                </label>
                <label>
                  Email для входа
                  <input
                    name="email"
                    defaultValue={editing?.email}
                    type="email"
                    required
                  />
                </label>
                <label>
                  {editing
                    ? "Новый пароль (пусто — оставить прежний)"
                    : "Пароль для ученика (передай лично)"}
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required={!editing}
                    minLength={10}
                  />
                </label>
                <label>
                  Класс / Предмет
                  <input name="grade" defaultValue={editing?.grade} />
                </label>
                <label>
                  Telegram chat_id
                  <input
                    name="telegramChatId"
                    defaultValue={editing?.telegramChatId}
                    placeholder="Например, 123456789"
                  />
                </label>
                <label>
                  VK peer_id
                  <input name="vkPeerId" defaultValue={editing?.vkPeerId} />
                </label>
              </>
            ) : modal === "Проверить" ? (
              <>
                <p>Ответ ученика:</p>
                <Content text={editing.response} />
                <label>
                  Результат
                  <select name="status">
                    <option>Принято</option>
                    <option>На доработку</option>
                  </select>
                </label>
                <label>
                  Обратная связь
                  <textarea
                    name="feedback"
                    rows={4}
                    defaultValue={editing.feedback}
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  Ученик
                  <select
                    name="studentId"
                    required
                    disabled={modal === "Занятие" && !!editing?.id}
                    defaultValue={editing?.studentId}
                  >
                    <option value="">Выбрать</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                {modal === "Занятие" ? (
                  <>
                    <label>
                      Тема
                      <input
                        name="title"
                        defaultValue={editing?.title}
                        required
                      />
                    </label>
                    <label>
                      Материал урока
                      <select
                        name="lessonMaterialId"
                        defaultValue={editing?.materialId || ""}
                      >
                        <option value="">Без материала</option>
                        {materials
                          .filter((m) => m.kind === "Урок")
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.title} · {m.tasks?.length || 0} заданий
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Дата и время (Екатеринбург)
                      <input
                        type="datetime-local"
                        name="startsAt"
                        defaultValue={localValue(editing?.startsAt)}
                        required
                      />
                    </label>
                    <div className="row">
                      <label>
                        Минут
                        <input
                          name="minutes"
                          type="number"
                          min="1"
                          max="480"
                          defaultValue={editing?.minutes || 60}
                          required
                        />
                      </label>
                      <label>
                        Стоимость, ₽
                        <input
                          name="price"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={editing?.price || 0}
                          required
                        />
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <label>
                      Материал
                      <select
                        name="materialId"
                        defaultValue={editing?.materialId}
                        required
                      >
                        <option value="">Выбрать</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title} · {m.kind}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Срок (Екатеринбург)
                      <input type="datetime-local" name="deadline" required />
                    </label>
                    <p className="footnote">
                      Один материал можно назначить нескольким ученикам. Ответ и
                      результат сохраняются для каждого назначения отдельно.
                    </p>
                  </>
                )}
              </>
            )}
            <button disabled={busy} className="primary">
              {busy ? "Сохранение…" : "Сохранить"}
            </button>
          </form>
        </div>
      )}
      {reader && !modal && (
        <div className="overlay">
          <article className="modal reader">
            {error && <div className="error">{error}</div>}
            <div className="section-title">
              <span className="tag">
                {reader.section} · {reader.kind}
              </span>
              <button
                className="icon"
                aria-label="Закрыть"
                onClick={() => setReader(null)}
              >
                <X />
              </button>
            </div>
            <h1>{reader.title}</h1>
            <Content text={reader.content} />
            <TaskList
              material={reader}
              tutor={tutor}
              assignment={currentAssignment}
              onChanged={async (a: any) => {
                setCurrentAssignment(a);
                await refresh();
              }}
              onReview={(r: any) => {
                create("Проверить", r);
                setReader(null);
              }}
            />
            <div className="files">
              {files.map((f) => (
                <div className="row" key={f.id}>
                  <a
                    href={"/api/files/" + f.id}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText size={16} />
                    {f.name}
                    <ArrowUpRight size={15} />
                  </a>
                  {[".pdf", ".jpg", ".png", ".jpeg", ".webp"].includes(
                    f.extension,
                  ) && (
                    <button className="link" onClick={() => setPreview(f)}>
                      Просмотр
                    </button>
                  )}
                </div>
              ))}
            </div>
            {preview &&
              (preview.extension === ".pdf" ? (
                <iframe
                  title={preview.name}
                  className="preview-file"
                  src={"/api/files/" + preview.id}
                />
              ) : (
                <img
                  className="preview-image"
                  alt={preview.name}
                  src={"/api/files/" + preview.id}
                />
              ))}
            {tutor ? (
              <>
                <label className="upload">
                  Прикрепить PDF, изображение, PPTX, DOCX, TXT (до 20 МБ)
                  <input
                    type="file"
                    disabled={busy}
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.pptx,.docx,.txt"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      void action(async () => {
                        const body = new FormData();
                        body.append("file", f);
                        await api("/files/" + reader.id, {
                          method: "POST",
                          body,
                        });
                        setFiles(await api("/files?materialId=" + reader.id));
                      });
                    }}
                  />
                </label>
                <p className="footnote">
                  PDF и изображения доступны внутри сайта. Для презентаций
                  используй экспорт из PowerPoint в PDF; PPTX хранится и
                  скачивается.
                </p>
                <div className="row">
                  <button
                    className="outline"
                    onClick={() => {
                      create("Материал", reader);
                      setReader(null);
                    }}
                  >
                    Редактировать
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      create("Назначить", { materialId: reader.id });
                      setReader(null);
                    }}
                  >
                    Назначить ученику
                  </button>
                </div>
              </>
            ) : null}
          </article>
        </div>
      )}
    </div>
  );
}
