import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { listCustomers } from "@/lib/admin-customers.functions";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/customers")({
  component: AdminCustomers,
});

function AdminCustomers() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";
  const [q, setQ] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "customers"],
    enabled: Boolean(accessToken),
    queryFn: () => listCustomers({ data: { accessToken } }),
  });

  const customers = data ?? [];
  const filteredCustomers = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return customers;

    return customers.filter((customer) => {
      const haystack = [customer.full_name, customer.email, customer.phone, customer.roles.join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [customers, q]);

  return (
    <div className="w-full">
      <AdminPageHeader
        title="Customers"
      />

      <div className="p-6">
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">All customers ({filteredCustomers.length})</p>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="customer-search"
                className="pl-9"
                placeholder="Search by name or email"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : error ? (
          <p className="mt-6 rounded-lg border border-destructive/40 bg-background p-6 text-sm">
            {(error as Error).message || "Couldn't load customers."}
          </p>
        ) : filteredCustomers.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-background p-10 text-center">
            <p className="font-medium">No customers found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Registered customer accounts will appear here once they are created.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-border">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Roles</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="border-t border-border bg-background">
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-3">
                          {customer.avatar_url ? (
                            <img
                              src={customer.avatar_url}
                              alt={customer.full_name ?? customer.email ?? "Customer"}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                              {((customer.full_name ?? customer.email ?? "C").slice(0, 1) || "C").toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-foreground">
                              {customer.full_name || "Unnamed customer"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {customer.legacy_user_id ? `Legacy ID: ${customer.legacy_user_id}` : "Auth account"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-muted-foreground">
                        {customer.email || "—"}
                      </td>
                      <td className="px-4 py-3 align-top text-muted-foreground">
                        {customer.phone || "—"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {customer.roles.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {customer.roles.map((role) => (
                              <Badge key={role} variant="secondary" className="capitalize">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-muted-foreground">
                        {customer.created_at ? formatDate(customer.created_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
