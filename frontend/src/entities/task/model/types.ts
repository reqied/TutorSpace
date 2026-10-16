export type TaskId = string;

export type Task = {
    id: TaskId;
    title: string;
    content: string;
    position: number;
    autoCheck: boolean;
    answer: string | null;
    solution: string | null;
}