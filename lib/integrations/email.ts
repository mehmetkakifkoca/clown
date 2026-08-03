// Email Provider Interface & Mock Implementations
// TODO: connect real OAuth/IMAP credentials for live production sync

export interface Attachment {
  name: string;
  size: string;
  type: "pdf" | "doc" | "image" | "zip";
  url?: string;
}

export interface EmailMessage {
  id: string;
  senderName: string;
  senderEmail: string;
  provider: "gmail" | "outlook" | "imap";
  subject: string;
  snippet: string;
  body: string;
  timestamp: string;
  isUnread: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
  avatarUrl: string;
  attachments?: Attachment[];
}

export interface EmailProvider {
  fetchMessages(filter?: string): Promise<EmailMessage[]>;
  getThread(id: string): Promise<EmailMessage | null>;
  sendReply(threadId: string, text: string): Promise<boolean>;
}

const MOCK_MESSAGES: EmailMessage[] = [
  {
    id: "msg-1",
    senderName: "Julianne Deville",
    senderEmail: "julianne.deville@gmail.com",
    provider: "gmail",
    subject: "Project status update & Q3 milestones deck",
    snippet: "Hey there! Attached are the latest Q3 design specs and product timeline for review before tomorrow's sync...",
    body: `Hi Alex,

I hope you're having a great week. 

I've finalized the Q3 product roadmap slides along with the updated component library tokens for the mobile app redesign. We've incorporated the Crimson design tokens and micro-interactions we discussed last Tuesday.

Please review the attached PDFs before our 10:00 AM call tomorrow. Let me know if you need any adjustments to the schedule or milestone deliverables.

Best regards,
Julianne Deville
Design Lead`,
    timestamp: "10:42 AM",
    isUnread: true,
    isFlagged: true,
    hasAttachments: true,
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
    attachments: [
      { name: "Q3_Roadmap_Deck_v2.pdf", size: "4.2 MB", type: "pdf" },
      { name: "Design_Tokens_Crimson.png", size: "1.8 MB", type: "image" }
    ]
  },
  {
    id: "msg-2",
    senderName: "Microsoft Team",
    senderEmail: "no-reply@account.microsoft.com",
    provider: "outlook",
    subject: "Action required: Security digest & new device sign-ins",
    snippet: "We detected a sign-in to your Microsoft 365 account from a new macOS device in London, UK...",
    body: `Hello,

Your Microsoft account security alert digest for August 2026 is ready. We detected 1 successful sign-in from a new browser session.

Device: macOS Sequoia / Safari
Location: London, UK (IP 192.168.1.100)

If this was you, no action is needed. If you did not recognize this activity, please reset your credential keys immediately.

Microsoft Security Team`,
    timestamp: "09:15 AM",
    isUnread: true,
    isFlagged: false,
    hasAttachments: false,
    avatarUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "msg-3",
    senderName: "Søren Kierkegaard",
    senderEmail: "soren@either-or.org",
    provider: "imap",
    subject: "On truth, subjectivity, and the aesthetic sphere",
    snippet: "The existential task of human existence is to become oneself, standing in relationship to the infinite...",
    body: `Dear Friend,

Life can only be understood backwards; but it must be lived forwards. In our daily pursuit of productivity, we must never lose sight of the qualitative leap of faith.

I look forward to continuing our philosophical correspondence during the weekend retreat.

Faithfully yours,
S. Kierkegaard`,
    timestamp: "Yesterday",
    isUnread: false,
    isFlagged: true,
    hasAttachments: false,
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "msg-4",
    senderName: "Alan Watts",
    senderEmail: "alan.watts@wayofzen.org",
    provider: "gmail",
    subject: "Audio archives & upcoming mindfulness lecture series",
    snippet: "The menu is not the meal. The key to effortless productivity is being fully present in the flow...",
    body: `Greetings,

Here is the link to the remastered audio recordings from the 1971 Big Sur seminars on playful attention and effortlessness.

Enjoy listening while working on your notes editor!

Warmly,
Alan Watts`,
    timestamp: "Aug 1",
    isUnread: false,
    isFlagged: false,
    hasAttachments: true,
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80",
    attachments: [
      { name: "Effortless_Attention_1971.mp3", size: "18.4 MB", type: "zip" }
    ]
  }
];

export class UnifiedEmailProvider implements EmailProvider {
  // TODO: connect real OAuth/IMAP credentials for live production sync

  async fetchMessages(filter?: string): Promise<EmailMessage[]> {
    let list = [...MOCK_MESSAGES];
    if (filter === "unread") {
      list = list.filter(m => m.isUnread);
    } else if (filter === "flagged") {
      list = list.filter(m => m.isFlagged);
    } else if (filter === "attachments") {
      list = list.filter(m => m.hasAttachments);
    }
    return list;
  }

  async getThread(id: string): Promise<EmailMessage | null> {
    const msg = MOCK_MESSAGES.find(m => m.id === id);
    return msg || MOCK_MESSAGES[0];
  }

  async sendReply(threadId: string, text: string): Promise<boolean> {
    console.log(`[EmailProvider] Reply sent to thread ${threadId}: ${text}`);
    return true;
  }
}

export const emailProvider = new UnifiedEmailProvider();
