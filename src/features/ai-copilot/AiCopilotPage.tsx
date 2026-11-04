import { useState, type FormEvent } from 'react'
import {
  Bot,
  MessageSquareText,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

export type CopilotMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
}

export type CopilotAssistant = {
  id: string
  name: string
  description?: string
}

export type CopilotSendRequest = {
  prompt: string
  assistantId?: string
}

export type AiCopilotPageProps = {
  messages?: readonly CopilotMessage[]
  assistants?: readonly CopilotAssistant[]
  selectedAssistantId?: string
  enabled?: boolean
  submitting?: boolean
  errorMessage?: string
  onSelectAssistant?: (assistantId: string) => void
  onSend?: (request: CopilotSendRequest) => void
  onNewConversation?: () => void
}

export default function AiCopilotPage({
  messages = [],
  assistants = [],
  selectedAssistantId,
  enabled = false,
  submitting = false,
  errorMessage,
  onSelectAssistant,
  onSend,
  onNewConversation,
}: AiCopilotPageProps) {
  const [draft, setDraft] = useState('')
  const [localAssistantId, setLocalAssistantId] = useState('')

  const selectedAssistant =
    assistants.find(
      (assistant) =>
        assistant.id ===
        (selectedAssistantId ?? localAssistantId),
    ) ?? assistants[0]

  const canSend = enabled && Boolean(onSend) && !submitting
  const messageText = draft.trim()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSend || !messageText || !onSend) {
      return
    }

    onSend({
      prompt: messageText,
      assistantId: selectedAssistant?.id,
    })

    setDraft('')
  }

  function handleAssistantSelection(assistantId: string) {
    setLocalAssistantId(assistantId)
    onSelectAssistant?.(assistantId)
  }

  return (
    <main className="ai-copilot-page">
      <header className="ai-copilot-page__header">
        <div>
          <p className="ai-copilot-page__eyebrow">
            D-GATE / SILVER CRM
          </p>

          <h1>AI Copilot</h1>

          <p className="ai-copilot-page__description">
            Your workspace for AI-assisted CRM insights,
            conversations, and productivity.
          </p>
        </div>

        <button
          type="button"
          className="ai-copilot-page__new-button"
          disabled={!enabled || !onNewConversation}
          onClick={onNewConversation}
        >
          <Plus size={18} aria-hidden="true" />
          New Conversation
        </button>
      </header>

      <div className="ai-copilot-page__workspace">
        <aside
          className="ai-copilot-page__assistants"
          aria-labelledby="copilot-assistants-title"
        >
          <div className="ai-copilot-page__panel-heading">
            <Sparkles size={20} aria-hidden="true" />
            <h2 id="copilot-assistants-title">
              Workspace Assistants
            </h2>
          </div>

          <p className="ai-copilot-page__panel-description">
            Select an assistant configured for your company.
          </p>

          {assistants.length > 0 ? (
            <div className="ai-copilot-page__assistant-list">
              {assistants.map((assistant) => (
                <button
                  key={assistant.id}
                  type="button"
                  className={
                    selectedAssistant?.id === assistant.id
                      ? 'ai-copilot-page__assistant ai-copilot-page__assistant--active'
                      : 'ai-copilot-page__assistant'
                  }
                  aria-pressed={
                    selectedAssistant?.id === assistant.id
                  }
                  onClick={() =>
                    handleAssistantSelection(assistant.id)
                  }
                >
                  <Bot size={19} aria-hidden="true" />

                  <span>
                    <strong>{assistant.name}</strong>

                    {assistant.description && (
                      <small>{assistant.description}</small>
                    )}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="ai-copilot-page__assistant-empty">
              <Bot size={27} aria-hidden="true" />

              <p>No assistants configured</p>

              <span>
                Authorized workspace assistants will
                appear after integration.
              </span>
            </div>
          )}

          <div className="ai-copilot-page__privacy-note">
            <ShieldCheck size={19} aria-hidden="true" />

            <p>
              Access to CRM information must be verified
              by the connected service.
            </p>
          </div>
        </aside>

        <section
          className="ai-copilot-page__chat"
          aria-labelledby="copilot-chat-title"
        >
          <div className="ai-copilot-page__chat-heading">
            <div className="ai-copilot-page__chat-heading-icon">
              <MessageSquareText
                size={21}
                aria-hidden="true"
              />
            </div>

            <div>
              <h2 id="copilot-chat-title">
                {selectedAssistant?.name ?? 'CRM Assistant'}
              </h2>

              <p>
                {enabled && onSend
                  ? 'AI conversation workspace'
                  : 'AI service integration pending'}
              </p>
            </div>
          </div>

          <div
            className="ai-copilot-page__messages"
            aria-label="Conversation messages"
            aria-live="polite"
          >
            {messages.length > 0 ? (
              <div className="ai-copilot-page__message-list">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={
                      message.role === 'user'
                        ? 'ai-copilot-page__message ai-copilot-page__message--user'
                        : 'ai-copilot-page__message ai-copilot-page__message--assistant'
                    }
                  >
                    <div className="ai-copilot-page__message-meta">
                      <strong>
                        {message.role === 'user'
                          ? 'You'
                          : 'Assistant'}
                      </strong>

                      {message.createdAt && (
                        <span>{message.createdAt}</span>
                      )}
                    </div>

                    <p>{message.content}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="ai-copilot-page__empty-state">
                <Sparkles size={37} aria-hidden="true" />

                <h3>Welcome to AI Copilot</h3>

                <p>
                  Your authorized CRM conversations will
                  appear here when the AI service is connected.
                </p>
              </div>
            )}
          </div>

          <div className="ai-copilot-page__composer-area">
            {errorMessage && (
              <p
                className="ai-copilot-page__error"
                role="alert"
              >
                {errorMessage}
              </p>
            )}

            <form
              className="ai-copilot-page__composer"
              onSubmit={handleSubmit}
            >
              <label
                className="ai-copilot-page__sr-only"
                htmlFor="copilot-prompt"
              >
                Message AI Copilot
              </label>

              <textarea
                id="copilot-prompt"
                rows={3}
                placeholder={
                  canSend
                    ? 'Ask your CRM assistant...'
                    : 'Messaging available after integration'
                }
                value={draft}
                disabled={!canSend}
                onChange={(event) =>
                  setDraft(event.target.value)
                }
              />

              <button
                type="submit"
                className="ai-copilot-page__send-button"
                disabled={!canSend || !messageText}
                aria-label="Send message"
              >
                <Send size={18} aria-hidden="true" />
                Send
              </button>
            </form>

            <p className="ai-copilot-page__disclaimer">
              AI responses may be inaccurate. Verify
              important business information before use.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}