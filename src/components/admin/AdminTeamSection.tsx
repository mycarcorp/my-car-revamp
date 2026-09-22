import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness, Pencil, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  deletePosition,
  listPositions,
  savePosition,
  setUserPosition,
  setUserRole,
  type AdminPosition,
} from "@/lib/admin-team.functions";

export type TeamAccount = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  legacy_user_id: string | number | null;
  created_at: string | null;
  roles: string[];
  position_id: number | null;
};

const isAdminAccount = (account: TeamAccount) =>
  (account.roles ?? []).some((role) => role.trim().toLowerCase().includes("admin"));

type RoleFilter = "all" | "admin" | "customer";

export function AdminTeamSection({
  accounts,
  accessToken,
  isLoading,
  error,
  search,
  onSearchChange,
}: {
  accounts: TeamAccount[];
  accessToken: string;
  isLoading: boolean;
  error: unknown;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("admin");
  const [editing, setEditing] = useState<AdminPosition | "new" | null>(null);

  const positionsQuery = useQuery({
    queryKey: ["admin", "positions"],
    enabled: Boolean(accessToken),
    queryFn: () => listPositions({ data: { accessToken } }),
  });

  const positions = (positionsQuery.data ?? []) as AdminPosition[];
  const positionsById = useMemo(
    () => new Map(positions.map((position) => [position.id, position])),
    [positions],
  );

  const refreshAccounts = () => queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
  const refreshPositions = () => queryClient.invalidateQueries({ queryKey: ["admin", "positions"] });

  const roleMutation = useMutation({
    mutationFn: (input: { userId: number; role: "admin" | "customer" }) =>
      setUserRole({ data: { accessToken, ...input } }),
    onSuccess: (_result, input) => {
      toast.success(input.role === "admin" ? "Account is now an admin" : "Account is now a customer");
      void refreshAccounts();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const positionMutation = useMutation({
    mutationFn: (input: { userId: number; positionId: number | null }) =>
      setUserPosition({ data: { accessToken, ...input } }),
    onSuccess: (_result, input) => {
      toast.success(input.positionId === null ? "Position removed" : "Position updated");
      void refreshAccounts();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePosition({ data: { accessToken, id } }),
    onSuccess: () => {
      toast.success("Position deleted");
      void refreshPositions();
      void refreshAccounts();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return accounts.filter((account) => {
      const admin = isAdminAccount(account);
      if (roleFilter === "admin" && !admin) return false;
      if (roleFilter === "customer" && admin) return false;
      if (!needle) return true;

      const position = account.position_id ? positionsById.get(account.position_id)?.name : "";

      return [account.full_name, account.email, account.phone, account.roles.join(" "), position]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [accounts, roleFilter, search, positionsById]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BriefcaseBusiness className="size-5" />
            </div>

            <div>
              <h2 className="font-semibold">Positions &amp; responsibilities</h2>
              <p className="text-sm text-muted-foreground">
                Create the roles your team can be assigned to, and what each one covers.
              </p>
            </div>
          </div>

          <Button type="button" onClick={() => setEditing("new")}>
            <Plus className="mr-2 size-4" />
            Add position
          </Button>
        </div>

        {positionsQuery.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading positions…</p>
        ) : positionsQuery.error ? (
          <div role="alert" className="p-6">
            <p className="font-medium text-destructive">Couldn&apos;t load positions</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {(positionsQuery.error as Error).message}
            </p>
          </div>
        ) : positions.length === 0 ? (
          <div className="p-10 text-center">
            <BriefcaseBusiness className="mx-auto size-9 text-muted-foreground/60" />
            <p className="mt-3 font-medium">No positions yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add one to start assigning responsibilities.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {positions.map((position) => (
              <li key={position.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{position.name}</p>
                  {position.description ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">{position.description}</p>
                  ) : null}

                  {position.responsibilities.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-1">
                      {position.responsibilities.map((item) => (
                        <li key={item}>
                          <Badge variant="secondary" className="max-w-full whitespace-normal text-left">
                            {item}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">No responsibilities listed.</p>
                  )}
                </div>

                <div className="flex shrink-0 gap-2 sm:justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditing(position)}>
                    <Pencil className="mr-2 size-4" />
                    Edit
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete “${position.name}”? Anyone assigned to it will have no position.`,
                        )
                      ) {
                        deleteMutation.mutate(position.id);
                      }
                    }}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border bg-muted/30 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>

            <div>
              <h2 className="font-semibold">Team access</h2>
              <p className="text-sm text-muted-foreground">
                Set who is an admin and which position they hold.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="customer">Customers</SelectItem>
                <SelectItem value="all">All accounts</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                className="pl-9"
                placeholder="Search accounts"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading accounts…</p>
        ) : error ? (
          <div role="alert" className="p-6">
            <p className="font-medium text-destructive">Couldn&apos;t load accounts</p>
            <p className="mt-1 text-sm text-muted-foreground">{(error as Error).message}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <ShieldCheck className="mx-auto size-9 text-muted-foreground/60" />
            <p className="mt-3 font-medium">No accounts found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Position</th>
                  <th className="px-4 py-3 font-medium">Responsibilities</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((account) => {
                  const admin = isAdminAccount(account);
                  const userId = Number(account.legacy_user_id ?? account.id);
                  const position = account.position_id
                    ? positionsById.get(account.position_id)
                    : undefined;

                  return (
                    <tr key={account.id} className="border-t border-border align-top hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium">{account.full_name || "Unnamed account"}</p>
                        <p className="text-xs text-muted-foreground">{account.phone || "No phone"}</p>
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">{account.email || "—"}</td>

                      <td className="px-4 py-3">
                        <Select
                          value={admin ? "admin" : "customer"}
                          disabled={roleMutation.isPending}
                          onValueChange={(value) =>
                            roleMutation.mutate({
                              userId,
                              role: value === "admin" ? "admin" : "customer",
                            })
                          }
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="customer">Customer</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      <td className="px-4 py-3">
                        <Select
                          value={account.position_id ? String(account.position_id) : "none"}
                          disabled={!admin || positionMutation.isPending}
                          onValueChange={(value) =>
                            positionMutation.mutate({
                              userId,
                              positionId: value === "none" ? null : Number(value),
                            })
                          }
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="No position" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No position</SelectItem>
                            {positions.map((item) => (
                              <SelectItem key={item.id} value={String(item.id)}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      <td className="px-4 py-3">
                        {position && position.responsibilities.length > 0 ? (
                          <div className="flex max-w-xs flex-wrap gap-1">
                            {position.responsibilities.map((item) => (
                              <Badge key={item} variant="secondary" className="whitespace-normal text-left">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {admin ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={roleMutation.isPending}
                              onClick={() => roleMutation.mutate({ userId, role: "customer" })}
                            >
                              <X className="mr-2 size-4" />
                              Remove admin
                            </Button>
                          ) : null}

                          {account.position_id ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={positionMutation.isPending}
                              onClick={() => positionMutation.mutate({ userId, positionId: null })}
                            >
                              <X className="mr-2 size-4" />
                              Remove position
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PositionDialog
        accessToken={accessToken}
        position={editing === "new" ? null : editing}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSaved={() => {
          setEditing(null);
          void refreshPositions();
        }}
      />
    </div>
  );
}

function PositionDialog({
  accessToken,
  position,
  open,
  onOpenChange,
  onSaved,
}: {
  accessToken: string;
  position: AdminPosition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [seeded, setSeeded] = useState<string>("");

  const key = `${open ? "open" : "closed"}:${position?.id ?? "new"}`;
  if (open && seeded !== key) {
    setSeeded(key);
    setName(position?.name ?? "");
    setDescription(position?.description ?? "");
    setResponsibilities((position?.responsibilities ?? []).join("\n"));
  }
  if (!open && seeded !== key) setSeeded(key);

  const saveMutation = useMutation({
    mutationFn: () =>
      savePosition({
        data: {
          accessToken,
          id: position?.id ?? null,
          name,
          description,
          responsibilities: responsibilities
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: () => {
      toast.success(position ? "Position updated" : "Position added");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{position ? "Edit position" : "Add position"}</DialogTitle>
          <DialogDescription>
            Name the position and list its responsibilities, one per line.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="position-name">Position name</Label>
            <Input
              id="position-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Sales manager"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="position-description">Description</Label>
            <Input
              id="position-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional short summary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="position-responsibilities">Responsibilities</Label>
            <Textarea
              id="position-responsibilities"
              rows={6}
              value={responsibilities}
              onChange={(event) => setResponsibilities(event.target.value)}
              placeholder={"Approve pricing\nFollow up on finance leads"}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saveMutation.isPending || !name.trim()}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Saving…" : position ? "Save changes" : "Add position"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
