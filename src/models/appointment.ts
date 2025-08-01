import db from "@/db";
import { serverOnly } from "@tanstack/react-start";
import { Either, Option, Schema } from "effect";
import {
  type ColumnType,
  type Generated,
  type Selectable,
  type Insertable,
  type Updateable,
  type JSONColumnType,
  sql,
} from "kysely";
import Visit from "./visit";
import { v1 as uuidV1 } from "uuid";
import {
  isValidUUID,
  safeJSONParse,
  safeStringify,
  toSafeDateString,
} from "@/lib/utils";
import Patient from "./patient";
import User from "./user";
import Clinic from "./clinic";

namespace Appointment {
  export const StatusSchema = Schema.Union(
    Schema.Literal("pending"),
    Schema.Literal("confirmed"),
    Schema.Literal("cancelled"),
    Schema.Literal("completed"),
    Schema.Literal("checked_in")
  );
  export const AppointmentSchema = Schema.Struct({
    id: Schema.String,
    provider_id: Schema.OptionFromNullOr(Schema.String),
    clinic_id: Schema.String,
    patient_id: Schema.String,
    user_id: Schema.String,
    current_visit_id: Schema.String,
    fulfilled_visit_id: Schema.OptionFromNullOr(Schema.String),
    timestamp: Schema.DateFromSelf,
    duration: Schema.Number,
    reason: Schema.String,
    notes: Schema.String,
    status: StatusSchema,
    metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    is_deleted: Schema.Boolean,
    created_at: Schema.DateFromSelf,
    updated_at: Schema.DateFromSelf,
    last_modified: Schema.DateFromSelf,
    server_created_at: Schema.DateFromSelf,
    deleted_at: Schema.OptionFromNullOr(Schema.DateFromSelf),
  });
  export type T = typeof AppointmentSchema.Type;
  export type EncodedT = typeof AppointmentSchema.Encoded;

  export namespace Table {
    export const name = "appointments";
    export const columns = {
      id: "id",
      provider_id: "provider_id",
      clinic_id: "clinic_id",
      patient_id: "patient_id",
      user_id: "user_id",
      current_visit_id: "current_visit_id",
      fulfilled_visit_id: "fulfilled_visit_id",
      timestamp: "timestamp",
      duration: "duration",
      reason: "reason",
      notes: "notes",
      status: "status",
      metadata: "metadata",
      is_deleted: "is_deleted",
      created_at: "created_at",
      updated_at: "updated_at",
      last_modified: "last_modified",
      server_created_at: "server_created_at",
      deleted_at: "deleted_at",
    };

    export interface T {
      id: string;
      provider_id: string | null;
      clinic_id: string;
      patient_id: string;
      user_id: string;
      current_visit_id: string;
      fulfilled_visit_id: string | null;
      timestamp: ColumnType<Date, string | undefined, Date | string>;
      duration: number;
      reason: string;
      notes: string;
      status: string;
      metadata: JSONColumnType<Record<string, unknown>>;
      is_deleted: Generated<boolean>;
      created_at: Generated<ColumnType<Date, string | undefined, never>>;
      updated_at: Generated<
        ColumnType<Date, string | undefined, string | undefined>
      >;
      last_modified: Generated<ColumnType<Date, string | undefined, never>>;
      server_created_at: Generated<ColumnType<Date, string | undefined, never>>;
      deleted_at: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
    }

    export type Appointments = Selectable<T>;
    export type NewAppointments = Insertable<T>;
    export type AppointmentsUpdate = Updateable<T>;
  }

  export namespace API {
    export const getAll = serverOnly(async (): Promise<EncodedT[]> => {
      const res = await db
        .selectFrom(Appointment.Table.name)
        .where("is_deleted", "=", false)
        .selectAll()
        .execute();

      return res as unknown as EncodedT[];
    });

    export const getById = serverOnly(async (id: string) => {
      const res = await db
        .selectFrom(Appointment.Table.name)
        .where("id", "=", id)
        .where("is_deleted", "=", false)
        .selectAll()
        .executeTakeFirst();

      return res as unknown as EncodedT | null;
    });

    export const getAllWithDetails = serverOnly(async () => {
      const res = await db.executeQuery<{
        appointment: Appointment.EncodedT;
        patient: Patient.EncodedT;
        clinic: Clinic.EncodedT;
        provider: User.EncodedT;
      }>(
        sql`
        SELECT 
          row_to_json(appointments.*) as appointment,
          row_to_json(patients.*) as patient,
          row_to_json(clinics.*) as clinic,
          row_to_json(users.*) as provider
        FROM appointments
        INNER JOIN patients ON appointments.patient_id = patients.id
        INNER JOIN clinics ON appointments.clinic_id = clinics.id
        INNER JOIN users ON appointments.provider_id = users.id
        WHERE appointments.is_deleted = false
      `.compile(db)
      );

      return res.rows;
    });

    export const toggleStatus = serverOnly(
      async (id: string, status: string) => {
        await db
          .updateTable(Appointment.Table.name)
          .set({
            status,
            updated_at: sql`now()::timestamp with time zone`,
            last_modified: sql`now()::timestamp with time zone`,
          })
          .where("id", "=", id)
          .execute();
      }
    );

    export const save = serverOnly(
      async (
        id: string | null,
        appointment: Appointment.EncodedT,
        currentUserName: string
      ) => {
        return await db.transaction().execute(async (trx) => {
          let visitId =
            appointment.current_visit_id &&
            isValidUUID(appointment.current_visit_id)
              ? appointment.current_visit_id
              : uuidV1();
          // If there is no visit Id, create a new visit
          if (!isValidUUID(appointment.current_visit_id)) {
            const visit = await trx
              .insertInto(Visit.Table.name)
              .values({
                id: visitId,
                patient_id: appointment.patient_id,
                clinic_id: appointment.clinic_id,
                provider_id: appointment.user_id, // the user_id is that of the current user, to a visit that is the provider
                is_deleted: false,
                created_at: sql`now()::timestamp with time zone`,
                updated_at: sql`now()::timestamp with time zone`,
                last_modified: sql`now()::timestamp with time zone`,
                server_created_at: sql`now()::timestamp with time zone`,
                deleted_at: null,
                metadata: {} as any,
                provider_name: currentUserName,
              })
              .returningAll()
              .executeTakeFirstOrThrow();

            console.log({ visit, oldVisitId: visitId });
            visitId = visit.id;
          }

          const res = await trx
            .insertInto(Appointment.Table.name)
            .values({
              id: id || appointment.id || uuidV1(),
              clinic_id: appointment.clinic_id,
              patient_id: appointment.patient_id,
              user_id: appointment.user_id,
              current_visit_id: visitId,
              created_at: sql`${toSafeDateString(
                appointment.created_at
              )}::timestamp with time zone`,
              updated_at: sql`${toSafeDateString(
                appointment.updated_at
              )}::timestamp with time zone`,
              last_modified: sql`now()::timestamp with time zone`,
              server_created_at: sql`now()::timestamp with time zone`,
              deleted_at: null,
              metadata: sql`${JSON.stringify(
                safeJSONParse(appointment.metadata, {})
              )}::jsonb`,
              duration: appointment.duration,
              reason: appointment.reason,
              notes: appointment.notes,
              status: appointment.status,
              fulfilled_visit_id: appointment.fulfilled_visit_id,
              timestamp: sql`${appointment.timestamp}::timestamp with time zone`,
              is_deleted: false,
              provider_id: appointment.provider_id,
            })
            .onConflict((oc) => {
              return oc.column("id").doUpdateSet({
                id: (eb) => eb.ref("excluded.id"),
                clinic_id: appointment.clinic_id,
                patient_id: (eb) => eb.ref("excluded.patient_id"),
                user_id: (eb) => eb.ref("excluded.user_id"),
                current_visit_id: (eb) => eb.ref("excluded.current_visit_id"),
                created_at: sql`${toSafeDateString(
                  appointment.created_at
                )}::timestamp with time zone`,
                updated_at: sql`${toSafeDateString(
                  appointment.updated_at
                )}::timestamp with time zone`,
                last_modified: (eb) => sql`now()::timestamp with time zone`,
                // server_created_at: (eb) => eb.ref("excluded.server_created_at"),
                deleted_at: (eb) => eb.ref("excluded.deleted_at"),
                metadata: (eb) => eb.ref("excluded.metadata"),
                duration: appointment.duration,
                reason: appointment.reason,
                notes: appointment.notes,
                status: appointment.status,
                //
                fulfilled_visit_id: appointment.fulfilled_visit_id,
                timestamp: sql`${appointment.timestamp}::timestamp with time zone`,
                is_deleted: false,
                provider_id: appointment.provider_id,
              });
            })
            .executeTakeFirstOrThrow();

          return res;
        });
      }
    );

    export const softDelete = serverOnly(async (id: string) => {
      return await db
        .updateTable(Table.name)
        .set({
          is_deleted: true,
          deleted_at: sql`now()::timestamp with time zone`,
          updated_at: sql`now()::timestamp with time zone`,
          last_modified: sql`now()::timestamp with time zone`,
        })
        .where("id", "=", id)
        .execute();
    });
  }

  export namespace Sync {
    export const upsertFromDelta = serverOnly(
      async (delta: Appointment.EncodedT) => {
        return API.save(delta.id || uuidV1(), delta, "");
      }
    );

    export const deleteFromDelta = serverOnly(async (id: string) => {
      return API.softDelete(id);
    });
  }
}

export default Appointment;
