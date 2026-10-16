import { useState } from "react";
import Content from "./Content";
import TextEditor from "./TextEditor";
import { send } from "./api";
function Task({ task, index, tutor, assignment, onChanged, onReview }: any) {
  const response = assignment?.responses?.find(
    (r: any) => r.taskId === task.id,
  );
  const [value, setValue] = useState(response?.response || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const a = await send(
        "/assignments/" + assignment.id + "/tasks/" + task.id + "/submit",
        { response: value },
      );
      await onChanged(a);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="lesson-task">
      <div className="section-title">
        <h2>
          {index + 1}. {task.title}
        </h2>
        <span
          className={
            "tag " +
            (["Верно", "Принято"].includes(response?.status) ? "success" : "")
          }
        >
          {response?.status ||
            (task.autoCheck ? "Автопроверка" : "Ручная проверка")}
        </span>
      </div>
      <Content text={task.content} />
      {tutor && (
        <details className="teacher-solution">
          <summary>Ответ и решение · только репетитору</summary>
          <h3>Ответ</h3>
          <Content text={task.answer || "Ответ не указан"} />
          <h3>Решение</h3>
          <Content text={task.solution || "Решение не добавлено"} />
        </details>
      )}
      {assignment &&
        (tutor ? (
          <div className="task-response">
            <b>Ответ ученика</b>
            {response ? (
              <>
                <Content text={response.response} />
                {response.feedback && <p>{response.feedback}</p>}
                <button
                  className="outline"
                  onClick={() =>
                    onReview({
                      id: assignment.id,
                      taskId: task.id,
                      response: response.response,
                      feedback: response.feedback,
                    })
                  }
                >
                  Проверить это задание
                </button>
              </>
            ) : (
              <p>Ещё не сдано</p>
            )}
          </div>
        ) : (
          <form onSubmit={submit}>
            {error && <div className="error">{error}</div>}
            <TextEditor
              label="Твой ответ"
              value={value}
              onChange={setValue}
              required
            />
            <button disabled={busy} className="primary">
              {busy
                ? "Отправка…"
                : task.autoCheck
                  ? "Проверить ответ"
                  : "Отправить репетитору"}
            </button>
            {response && <p>{response.status}</p>}
            {response?.feedback && (
              <div className="notice">{response.feedback}</div>
            )}
          </form>
        ))}
    </section>
  );
}
export default function TaskList({
  material,
  tutor,
  assignment,
  onChanged,
  onReview,
}: any) {
  return (
    <div className="lesson-tasks">
      {(material.tasks || []).map((t: any, index: number) => (
        <Task
          key={t.id}
          task={t}
          index={index}
          tutor={tutor}
          assignment={assignment}
          onChanged={onChanged}
          onReview={onReview}
        />
      ))}
      {!material.tasks?.length && <p className="footnote">Пока нет заданий.</p>}
      {!tutor && !assignment && material.tasks?.length > 0 && (
        <p className="footnote">
          Это просмотр урока. Для сдачи ответов открой его назначение в разделе
          «Задания».
        </p>
      )}
    </div>
  );
}
