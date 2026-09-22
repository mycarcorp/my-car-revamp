import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  ChevronDown,
  GripVertical,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  deletePosition,
  listPositions,
  reorderPositions,
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
  const positionMenuRef = useRef<HTMLDivElement>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("admin");
  const [editing, setEditing] = useState<AdminPosition | null>(null);
  const [positionMenuOpen, setPositionMenuOpen] = useState(false);
  const [newPositionName, setNewPositionName] = useState("");
  const [orderedPositions, setOrderedPositions] = useState<AdminPosition[]>([]);
  const [draggedPositionId, setDraggedPositionId] = useState<number | null>(null);

  const positionsQuery = useQuery({
    queryKey: ["admin", "positions"],
    enabled: Boolean(accessToken),
    queryFn: () => listPositions({ data: { accessToken } }),
  });

  const positions = orderedPositions;

  useEffect(() => {
    setOrderedPositions((positionsQuery.data ?? []) as AdminPosition[]);
  }, [positionsQuery.data]);

  useEffect(() => {
    if (!positionMenuOpen) return;
    const closeWhenOutside = (event: MouseEvent) => {
      if (!positionMenuRef.current?.contains(event.target as Node)) setPositionMenuOpen(false);
    };
    document.addEventListener("mousedown", closeWhenOutside);
    return () => document.removeEventListener("mousedown", closeWhenOutside);
  }, [positionMenuOpen]);

  const positionsById = useMemo(() => new Map(positions.map((position) => [position.id, position])), [positions]);

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

  const addPositionMutation = useMutation({
    mutationFn: (name: string) =>
      savePosition({
        data: { accessToken, id: null, name, description: null, responsibilities: [] },
      }),
    onSuccess: () => {
      setNewPositionName("");
      toast.success("Position added");
      void refreshPositions();
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

  const reorderMutation = useMutation({
    mutationFn: (positionIds: number[]) => reorderPositions({ data: { accessToken, positionIds } }),
    onSuccess: () => {
      toast.success("Position hierarchy updated");
      void refreshPositions();
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message);
      void refreshPositions();
    },
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

  const trimmedPositionName = newPositionName.trim();
  const positionAlreadyExists = positions.some(
    (position) => position.name.trim().toLowerCase() === trimmedPositionName.toLowerCase(),
  );
  const canAddPosition = Boolean(trimmedPositionName) && !positionAlreadyExists;

  const movePosition = (targetId: number) => {
    if (draggedPositionId === null || draggedPositionId === targetId) return;
    const fromIndex = positions.findIndex((item) => item.id === draggedPositionId);
    const toIndex = positions.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...positions];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setOrderedPositions(next);
    setDraggedPositionId(null);
    reorderMutation.mutate(next.map((item) => item.id));
  };

  return (
    <div>
      <section className="overflow-visible rounded-xl border border-border bg-background shadow-sm">
        <div className="flex flex-col gap-4 rounded-t-xl border-b border-border bg-muted/30 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold">Team access</h2>
              <p className="text-sm text-muted-foreground">
                Manage account access, team positions, and position hierarchy.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
            <div ref={positionMenuRef} className="relative">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between gap-2 sm:w-48"
                onClick={() => setPositionMenuOpen((open) => !open)}
                aria-expanded={positionMenuOpen}
              >
                <span className="flex items-center gap-2">
                  <BriefcaseBusiness className="size-4" />
                  Positions ({positions.length})
                </span>
                <ChevronDown className={`size-4 transition-transform ${positionMenuOpen ? "rotate-180" : ""}`} />
              </Button>

              {positionMenuOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-3rem))] rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl">
                  <div className="border-b border-border p-2">
                    <p className="text-sm font-medium">Position hierarchy</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Drag positions to reorder them. The top position is highest.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Input
                        value={newPositionName}
                        onChange={(event) => setNewPositionName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && canAddPosition) {
                            event.preventDefault();
                            addPositionMutation.mutate(trimmedPositionName);
                          }
                        }}
                        placeholder="Type a new position"
                        aria-label="New position name"
                      />
                      <Button
                        type="button"
                        size="icon"
                        aria-label="Add position"
                        title={positionAlreadyExists ? "This position already exists" : "Add position"}
                        disabled={!canAddPosition || addPositionMutation.isPending}
                        onClick={() => addPositionMutation.mutate(trimmedPositionName)}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                    {positionAlreadyExists ? (
                      <p className="mt-1.5 text-xs text-destructive">That position already exists.</p>
                    ) : null}
                  </div>

                  <div className="max-h-80 overflow-y-auto py-1">
                    {positionsQuery.isLoading ? (
                      <p className="p-3 text-sm text-muted-foreground">Loading positions…</p>
                    ) : positionsQuery.error ? (
                      <p className="p-3 text-sm text-destructive">{(positionsQuery.error as Error).message}</p>
                    ) : positions.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">No positions yet.</p>
                    ) : (
                      positions.map((position, index) => (
                        <div
                          key={position.id}
                          draggable={!reorderMutation.isPending}
                          onDragStart={() => setDraggedPositionId(position.id)}
                          onDragEnd={() => setDraggedPositionId(null)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            movePosition(position.id);
                          }}
                          className={`group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/70 ${
                            draggedPositionId === position.id ? "opacity-50" : ""
                          }`}
                        >
                          <button
                            type="button"
                            className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                            aria-label={`Drag ${position.name}`}
                            title="Drag to reorder"
                          >
                            <GripVertical className="size-4" />
                          </button>
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{position.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {position.description || `${position.responsibilities.length} responsibilities`}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Edit ${position.name}`}
                            onClick={() => setEditing(position)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            aria-label={`Delete ${position.name}`}
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (window.confirm(`Delete “${position.name}”? Assigned users will have no position.`)) {
                                deleteMutation.mutate(position.id);
                              }
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
              <SelectTrigger className="w-full sm:w-40">
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
          <div className="overflow-x-auto rounded-b-xl">
            <table className="w-full min-w-[900px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[22%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[10%]" />
              </colgroup>
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
                  const position = account.position_id ? positionsById.get(account.position_id) : undefined;
                  return (
                    <tr key={account.id} className="border-t border-border align-top hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {account.avatar_url ? (
                            <img src={account.avatar_url} alt="" className="size-9 rounded-full object-cover" />
                          ) : (
                            <div className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                              {(account.full_name || account.email || "A").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium">{account.full_name || "Unnamed account"}</p>
                            <p className="truncate text-xs text-muted-foreground">{account.phone || "No phone"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="truncate px-4 py-3 text-muted-foreground">{account.email || "—"}</td>
                      <td className="px-4 py-3">
                        <Select
                          value={admin ? "admin" : "customer"}
                          disabled={roleMutation.isPending}
                          onValueChange={(value) =>
                            roleMutation.mutate({ userId, role: value === "admin" ? "admin" : "customer" })
                          }
                        >
                          <SelectTrigger className="w-full">
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
                            positionMutation.mutate({ userId, positionId: value === "none" ? null : Number(value) })
                          }
                        >
                          <SelectTrigger className="w-full">
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
                        {position?.responsibilities.length ? (
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
                        <div className="flex gap-1">
                          {admin ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Remove admin"
                              disabled={roleMutation.isPending}
                              onClick={() => roleMutation.mutate({ userId, role: "customer" })}
                            >
                              <X className="size-4" />
                            </Button>
                          ) : null}
                          {account.position_id ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Remove position"
                              disabled={positionMutation.isPending}
                              onClick={() => positionMutation.mutate({ userId, positionId: null })}
                            >
                              <BriefcaseBusiness className="size-4" />
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
        position={editing}
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

  useEffect(() => {
    if (!open) return;
    setName(position?.name ?? "");
    setDescription(position?.description ?? "");
    setResponsibilities((position?.responsibilities ?? []).join("\n"));
  }, [open, position]);

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
      toast.success("Position updated");
      onSaved();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit position</DialogTitle>
          <DialogDescription>Update the position name and responsibilities.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="position-name">Position name</Label>
            <Input id="position-name" value={name} onChange={(event) => setName(event.target.value)} />
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
          <Button type="button" disabled={saveMutation.isPending || !name.trim()} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
