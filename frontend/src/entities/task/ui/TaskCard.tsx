import {Task} from "../model/types.ts";

type TaskCardProps = {
    task: Task;
    showSolution: boolean;
}

export function TaskCard({task, showSolution = false} : TaskCardProps) {
    return (
        <article>
            <h3>{task.title}</h3>

            <div style={{ whiteSpace: 'pre-wrap' }}>
                {task.content}
            </div>

            <p>
                {task.autoCheck ? 'Автопроверка' : 'Ручная проверка'}
            </p>

            {showSolution && (
                <details>
                    <summary>Ответ и решение</summary>

                    <h4>Ответ</h4>
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                        {task.answer || 'Ответ не указан'}
                    </div>

                    <h4>Решение</h4>
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                        {task.solution || 'Решение не добавлено'}
                    </div>
                </details>
            )}
        </article>
    );
}