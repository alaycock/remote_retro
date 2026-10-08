defmodule RemoteRetro.StagesTest do
  use ExUnit.Case, async: true
  alias RemoteRetro.Stages

  test "next/prev walk the single progression" do
    assert Stages.next("lobby") == "prime-directive"
    assert Stages.next("closed") == nil
    assert Stages.prev("lobby") == nil
    assert Stages.prev("closed") == "action-items"
  end

  test "adjacent? allows exactly one step either way" do
    assert Stages.adjacent?("grouping", "voting")
    assert Stages.adjacent?("voting", "grouping")
    refute Stages.valid?("labeling")
    assert Stages.adjacent?("closed", "action-items")
    refute Stages.adjacent?("grouping", "action-items")
    refute Stages.adjacent?("grouping", "grouping")
    refute Stages.adjacent?("closed", nil)
  end
end
