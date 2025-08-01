import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import Clinic from "@/models/clinic";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LucideEdit, LucideTrash } from "lucide-react";
import { toast } from "sonner";
import { getAllClinics } from "@/lib/server-functions/clinics";
import { Link } from "@tanstack/react-router";

const deleteClinic = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    return Clinic.softDelete(data.id);
  });

export const Route = createFileRoute("/app/clinics/")({
  component: RouteComponent,
  loader: async () => {
    const clinics = await getAllClinics();
    return { clinics };
  },
});

function RouteComponent() {
  const { clinics } = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();

  const handleEdit = (id: string) => {
    navigate({ to: `/app/clinics/edit/${id}` });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this clinic?")) {
      return;
    }

    deleteClinic({ data: { id } })
      .catch((error) => {
        console.error(error);
        toast.error(error.message);
      })
      .then(() => {
        toast.success("Clinic deleted successfully");
        router.invalidate({ sync: true });
      });
  };

  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Clinics</h1>
        <Button asChild>
          <Link to="/app/clinics/edit/$" params={{ _splat: "new" }}>
            Add Clinic
          </Link>
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clinics?.map((clinic) => (
              <TableRow key={clinic.id} className="py-2">
                <TableCell>{clinic.name}</TableCell>
                <TableCell className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => handleEdit(clinic.id)}
                  >
                    <LucideEdit className="mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-500"
                    onClick={() => handleDelete(clinic.id)}
                  >
                    <LucideTrash className="mr-2" />
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
