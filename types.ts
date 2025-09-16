export enum Role {
    USER = 'user',
    ASSISTANT = 'assistant',
}

export enum Feedback {
    UP = 'up',
    DOWN = 'down',
}

export interface Source {
    uri: string;
    title: string;
}
  
export interface Message {
    id: string;
    role: Role;
    text: string;
    sources?: Source[];
    feedback?: Feedback;
}

export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
}