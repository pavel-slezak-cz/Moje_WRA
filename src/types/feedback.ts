export interface Feedback {
    id: string;          // unikátní identifikátor
    user: string;        // jméno nebo ID respondenta
    answers: Record<string, string>; // odpovědi na jednotlivé otázky
    createdAt: string;   // ISO timestamp
}
