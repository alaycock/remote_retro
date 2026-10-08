import { Component, type ErrorInfo, type ReactNode } from "react"

interface Props {
  children: ReactNode
  /** Changing this key clears a caught error (e.g. on stage change). */
  resetKey?: unknown
}

interface State {
  error: Error | null
  resetKey?: unknown
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto my-12 max-w-md px-4 text-center">
        <span className="hero-exclamation-triangle size-10 text-warning" aria-hidden="true" />
        <h2 className="mt-2 text-lg font-semibold">Something went wrong</h2>
        <p className="mt-1 text-base-content/70">This part of the retro hit an unexpected error.</p>
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" className="btn btn-sm" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      </div>
    )
  }
}
