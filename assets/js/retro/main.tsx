import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Provider } from "react-redux"
import { App } from "./App"
import { RetroChannel } from "./channel"
import { makeStore } from "./store"
import { bindChannel } from "./store/bind_channel"
import { connectedChanged, currentUserSet, snapshotReceived } from "./store/slices"

async function boot(root: HTMLElement) {
  const { retroId, userToken, userId } = root.dataset as Record<string, string>
  const channel = new RetroChannel(retroId, userToken)
  const store = makeStore(channel)
  store.dispatch(currentUserSet(Number(userId)))
  bindChannel(channel, store.dispatch)
  channel.onConnectionChange((connected) => store.dispatch(connectedChanged(connected)))
  channel.onRejoin((snapshot) => store.dispatch(snapshotReceived(snapshot)))

  const snapshot = await channel.join()
  store.dispatch(snapshotReceived(snapshot))
  store.dispatch(connectedChanged(true))

  createRoot(root).render(
    <StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </StrictMode>,
  )
}

const root = document.getElementById("retro-root")
if (root) {
  boot(root).catch((error) => {
    console.error(error)
    root.innerHTML = ""
    const message = document.createElement("div")
    message.className = "grid h-full place-items-center p-6 text-center"
    message.innerHTML =
      '<div><p class="text-lg font-semibold">Could not join this retro.</p>' +
      '<p class="mt-1 text-base-content/70">Try refreshing, or go back to <a class="link" href="/retros">your retros</a>.</p></div>'
    root.appendChild(message)
  })
}
