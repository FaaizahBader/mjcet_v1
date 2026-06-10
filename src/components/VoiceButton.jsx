export default function VoiceButton({ listening, supported, onClick }) {
  return (
    <button
      type="button"
      className={`voice-button${listening ? ' listening' : ''}`}
      onClick={onClick}
      disabled={!supported}
      aria-label={listening ? 'Listening for destination' : 'Speak destination'}
      title={
        supported
          ? 'Tap and speak your destination'
          : 'Voice input is not supported in this browser'
      }
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="voice-icon">
        <path
          fill="currentColor"
          d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.71V21h2v-3.29A7 7 0 0 0 19 11h-2Z"
        />
      </svg>
    </button>
  )
}
