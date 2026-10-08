defmodule RemoteRetro.AI.CredentialsTest do
  use ExUnit.Case, async: true
  alias RemoteRetro.AI.Credentials

  test "maps ADC JSON types to Goth sources" do
    sa = %{"type" => "service_account", "client_email" => "x@y"}

    user = %{
      "type" => "authorized_user",
      "refresh_token" => "r",
      "client_id" => "c",
      "client_secret" => "s"
    }

    assert Credentials.source_for(sa) == {{:service_account, sa}, nil}
    assert Credentials.source_for(user) == {{:refresh_token, user}, nil}

    impersonated = %{
      "type" => "impersonated_service_account",
      "source_credentials" => user,
      "service_account_impersonation_url" => "https://iam/sa:generateAccessToken"
    }

    assert Credentials.source_for(impersonated) ==
             {{:refresh_token, user}, %{url: "https://iam/sa:generateAccessToken", delegates: []}}
  end

  test "falls back to the metadata server for unknown types" do
    ExUnit.CaptureLog.capture_log(fn ->
      assert Credentials.source_for(%{"type" => "external_account"}) == {:metadata, nil}
    end)
  end
end
