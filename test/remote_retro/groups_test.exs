defmodule RemoteRetro.GroupsTest do
  use RemoteRetro.DataCase, async: true
  import RemoteRetro.Fixtures
  alias RemoteRetro.{Groups, Ideas}
  alias RemoteRetro.Groups.Group
  alias RemoteRetro.Votes.Vote

  setup do
    user = user_fixture()
    %{user: user, retro: retro_fixture(user, %{stage: "grouping"})}
  end

  defp at(retro, user, x, y, attrs \\ %{}),
    do: idea_fixture(retro, user, Map.merge(%{x: x * 1.0, y: y * 1.0}, attrs))

  defp group_of(idea), do: Repo.reload!(idea).group_id

  test "every positioned idea gets exactly one group; singletons get their own", %{
    retro: retro,
    user: user
  } do
    a = at(retro, user, 0, 0)
    b = at(retro, user, 50, 50)
    c = at(retro, user, 1000, 0)
    unplaced = idea_fixture(retro, user)
    action = at(retro, user, 0, 0, %{category: "action-item", assignee_id: user.id})

    assert {:ok, %{groups: groups, ideas: changed}} = Groups.sync(retro.id)
    assert length(groups) == 2
    assert group_of(a) == group_of(b)
    assert group_of(c) not in [nil, group_of(a)]
    assert group_of(unplaced) == nil
    assert group_of(action) == nil
    assert changed |> Enum.map(& &1.id) |> Enum.sort() == Enum.sort([a.id, b.id, c.id])
    assert %{x: +0.0, y: +0.0} = Enum.find(changed, &(&1.id == a.id))
  end

  test "sync is idempotent", %{retro: retro, user: user} do
    at(retro, user, 0, 0)
    at(retro, user, 50, 50)
    at(retro, user, 900, 900)

    {:ok, first} = Groups.sync(retro.id)
    assert {:ok, %{groups: groups, ideas: []}} = Groups.sync(retro.id)
    assert Enum.map(groups, & &1.id) == Enum.map(first.groups, & &1.id)
  end

  test "a split keeps the id and label on the larger side", %{retro: retro, user: user} do
    group = group_fixture(retro, %{label: "Deploys", label_source: "user"})
    a = at(retro, user, 0, 0, %{group_id: group.id})
    b = at(retro, user, 50, 0, %{group_id: group.id})
    c = at(retro, user, 2000, 0, %{group_id: group.id})

    {:ok, %{groups: groups}} = Groups.sync(retro.id)

    assert group_of(a) == group.id and group_of(b) == group.id
    assert group_of(c) != group.id
    assert Enum.find(groups, &(&1.id == group.id)).label == "Deploys"
    assert Enum.find(groups, &(&1.id == group_of(c))).label == nil
  end

  test "a merge keeps the majority id and deletes the absorbed group with its votes", %{
    retro: retro,
    user: user
  } do
    big = group_fixture(retro, %{label: "Big"})
    small = group_fixture(retro, %{label: "Small"})
    vote = vote_fixture(small, user)
    at(retro, user, 0, 0, %{group_id: big.id})
    at(retro, user, 50, 0, %{group_id: big.id})
    s = at(retro, user, 100, 0, %{group_id: small.id})

    {:ok, %{groups: groups, ideas: changed}} = Groups.sync(retro.id)

    assert Enum.map(groups, & &1.id) == [big.id]
    assert group_of(s) == big.id
    assert [%{id: id, group_id: gid}] = changed
    assert {id, gid} == {s.id, big.id}
    refute Repo.get(Group, small.id)
    refute Repo.get(Vote, vote.id)
  end

  test "ties pick the lowest group id", %{retro: retro, user: user} do
    g1 = group_fixture(retro)
    g2 = group_fixture(retro)
    at(retro, user, 0, 0, %{group_id: g2.id})
    at(retro, user, 50, 0, %{group_id: g1.id})

    {:ok, %{groups: groups}} = Groups.sync(retro.id)
    assert Enum.map(groups, & &1.id) == [g1.id]
  end

  test "ungrouping ideas that lose their position, and dropping empty groups", %{
    retro: retro,
    user: user
  } do
    g = group_fixture(retro)
    idea = idea_fixture(retro, user, %{group_id: g.id})

    assert {:ok, %{groups: [], ideas: [%{id: id, group_id: nil}]}} = Groups.sync(retro.id)
    assert id == idea.id
  end

  test "other retros are untouched", %{retro: retro, user: user} do
    other = retro_fixture(user, %{stage: "grouping"})
    other_group = group_fixture(other)
    other_idea = at(other, user, 0, 0, %{group_id: other_group.id})
    at(retro, user, 0, 0)

    {:ok, _} = Groups.sync(retro.id)
    assert group_of(other_idea) == other_group.id
    assert Ideas.list_ideas(other.id) |> length() == 1
  end

  test "update_label trims, records the user as source and clears blanks", %{retro: retro} do
    group = group_fixture(retro, %{label: "x", label_source: "ai"})

    assert {:ok, %Group{label: "Flaky CI", label_source: "user"}} =
             Groups.update_label(retro, group.id, "  Flaky CI ")

    assert {:ok, %Group{label: nil}} = Groups.update_label(retro, group.id, "   ")

    assert {:error, %Ecto.Changeset{}} =
             Groups.update_label(retro, group.id, String.duplicate("a", 61))

    assert {:error, :not_found} = Groups.update_label(retro, group.id + 1000, "x")
  end
end
