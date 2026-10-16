import { useEffect, useRef, useState } from "react";
import { HubConnectionBuilder } from "@microsoft/signalr";
import { api, send } from "./api";
type Stroke = { color: string; width: number; points: number[][] };
export default function Board({ lessons, students }: any) {
  const [id, setId] = useState(lessons[0]?.id || ""),
    [board, setBoard] = useState<any>(null),
    [color, setColor] = useState("#315647"),
    [width, setWidth] = useState(3),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    current = useRef<Stroke | null>(null),
    pending = useRef(false),
    latest = useRef<any>(null),
    remote = useRef<any>(null),
    activeId = useRef(id);
  latest.current = board;
  activeId.current = id;
  useEffect(() => {
    if (!id) return;
    let alive = true;
    setBoard(null);
    setMessage("Подключение…");
    api("/boards/" + id)
      .then((b) => {
        if (alive) {
          setBoard(b);
          setMessage("Загружено");
        }
      })
      .catch((e) => setMessage(e.message));
    const c = new HubConnectionBuilder()
      .withUrl("/hubs/board")
      .withAutomaticReconnect()
      .build();
    c.on("BoardUpdated", (b) => {
      if (!alive) return;
      if (current.current || pending.current) {
        remote.current = b;
        return;
      }
      if (!latest.current || b.version >= latest.current.version) setBoard(b);
    });
    c.onreconnected(async () => {
      await c.invoke("Join", id);
      let b = await api("/boards/" + id);
      if (alive) {
        setBoard(b);
        setMessage("Подключение восстановлено");
      }
    });
    c.start()
      .then(() => {
        if (alive) return c.invoke("Join", id);
      })
      .then(() => {
        if (alive) setMessage("Совместная доска подключена");
      })
      .catch(() => {
        if (alive)
          setMessage("Нет связи с доской. Сохранение работает через сервер.");
      });
    return () => {
      alive = false;
      current.current = null;
      remote.current = null;
      void c.stop();
    };
  }, [id]);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 1200, 650);
    if (!board) return;
    try {
      for (const s of JSON.parse(board.data)) {
        ctx.beginPath();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        s.points.forEach((p: number[], i: number) =>
          i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]),
        );
        ctx.stroke();
      }
    } catch {
      setMessage("Не удалось прочитать рисунок");
    }
  }, [board]);
  function pos(e: React.PointerEvent) {
    const r = canvas.current!.getBoundingClientRect();
    return [
      ((e.clientX - r.left) * 1200) / r.width,
      ((e.clientY - r.top) * 650) / r.height,
    ];
  }
  async function save(lines: Stroke[]) {
    if (!board || pending.current) return;
    const target = id;
    pending.current = true;
    setBusy(true);
    setMessage("Сохранение…");
    try {
      let b = await send(
        "/boards/" + target,
        { data: JSON.stringify(lines), version: board.version },
        "PUT",
      );
      if (activeId.current === target) {
        if (remote.current && remote.current.version > b.version)
          b = remote.current;
        setBoard(b);
        setMessage("Сохранено");
      }
    } catch (e: any) {
      if (activeId.current === target) {
        setMessage(
          e.message + " Твой последний штрих не сохранён, повтори его.",
        );
        try {
          setBoard(await api("/boards/" + target));
        } catch {}
      }
    } finally {
      remote.current = null;
      pending.current = false;
      setBusy(false);
    }
  }
  function finish() {
    const s = current.current;
    if (!s) return;
    current.current = null;
    if (s.points.length === 1)
      s.points.push([s.points[0][0] + 0.1, s.points[0][1] + 0.1]);
    void save([...JSON.parse(board.data), s]);
  }
  if (!lessons.length)
    return (
      <div className="empty">
        Сначала запланируй занятие — у каждого урока своя доска.
      </div>
    );
  return (
    <>
      <div className="toolbar">
        <select
          disabled={busy}
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          {lessons.map((l: any) => (
            <option key={l.id} value={l.id}>
              {students.find((s: any) => s.id === l.studentId)?.name} ·{" "}
              {l.title}
            </option>
          ))}
        </select>
        <div className="row">
          {["#315647", "#805aa9", "#cc684b", "#ffffff"].map((c) => (
            <button
              key={c}
              aria-label={"Цвет " + c}
              className={"swatch " + (color === c ? "picked" : "")}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
          <select value={width} onChange={(e) => setWidth(+e.target.value)}>
            <option value="3">Тонко</option>
            <option value="7">Толсто</option>
            <option value="25">Ластик</option>
          </select>
          <button
            disabled={!board || busy}
            className="outline"
            onClick={() => void save(JSON.parse(board.data).slice(0, -1))}
          >
            Отменить штрих
          </button>
        </div>
      </div>
      <div className="board-info">
        <span>{message}</span>
        <span>Рисунок сохраняется после каждого штриха</span>
      </div>
      <div className="canvas-wrap">
        <canvas
          ref={canvas}
          width="1200"
          height="650"
          onPointerDown={(e) => {
            if (!board || busy) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            current.current = {
              color: width === 25 ? "#fff" : color,
              width,
              points: [pos(e)],
            };
          }}
          onPointerMove={(e) => {
            if (!current.current) return;
            const s = current.current,
              p = pos(e),
              last = s.points.at(-1)!,
              ctx = canvas.current!.getContext("2d")!;
            ctx.beginPath();
            ctx.strokeStyle = s.color;
            ctx.lineWidth = s.width;
            ctx.lineCap = "round";
            ctx.moveTo(last[0], last[1]);
            ctx.lineTo(p[0], p[1]);
            ctx.stroke();
            s.points.push(p);
          }}
          onPointerUp={finish}
          onPointerCancel={finish}
        />
      </div>
      <p className="footnote">
        При одновременном сохранении сервер отклонит устаревший рисунок и
        загрузит свежий. Отменённый из-за конфликта штрих нужно повторить. Не
        переключай урок до завершения сохранения.
      </p>
    </>
  );
}
