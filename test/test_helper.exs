Mox.defmock(RemoteRetro.AI.RunnerMock, for: RemoteRetro.AI.Runner)
Mox.defmock(RemoteRetro.AI.ClientMock, for: RemoteRetro.AI.Client)
ExUnit.start()
Ecto.Adapters.SQL.Sandbox.mode(RemoteRetro.Repo, :manual)
