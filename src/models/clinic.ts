import { Option, Schema, Either } from "effect";
import {
  type ColumnType,
  type Generated,
  type Selectable,
  type Insertable,
  type Updateable,
  sql,
} from "kysely";
import db from "@/db";
import { serverOnly } from "@tanstack/react-start";
import { v1 as uuidV1 } from "uuid";
import User from "./user";

namespace Clinic {
  export const ClinicSchema = Schema.Struct({
    id: Schema.String,
    name: Schema.OptionFromNullOr(Schema.String),
    is_deleted: Schema.OptionFromNullOr(Schema.Boolean),
    created_at: Schema.DateFromSelf,
    updated_at: Schema.DateFromSelf,
    last_modified: Schema.DateFromSelf,
    server_created_at: Schema.DateFromSelf,
    deleted_at: Schema.OptionFromNullOr(Schema.DateFromSelf),
  });
  export type T = typeof ClinicSchema.Type;
  export type EncodedT = typeof ClinicSchema.Encoded;

  export const fromDbEntry = (
    entry: Clinic.Table.Clinics
  ): Either.Either<Clinic.T, Error> => {
    return Schema.decodeUnknownEither(ClinicSchema)(entry);
  };
  // export type T = {
  //   id: string;
  //   name: string | null;
  //   is_deleted: Option.Option<boolean>;
  //   created_at: Date;
  //   updated_at: Date;
  //   last_modified: Date;
  //   server_created_at: Date;
  //   deleted_at: Option.Option<Date>;
  // };

  export namespace Table {
    export const name = "clinics";
    export const columns = {
      id: "id",
      name: "name",
      is_deleted: "is_deleted",
      created_at: "created_at",
      updated_at: "updated_at",
      last_modified: "last_modified",
      server_created_at: "server_created_at",
      deleted_at: "deleted_at",
    };

    export interface T {
      id: string;
      name: string | null;
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
    export type Clinics = Selectable<T>;
    export type NewClinics = Insertable<T>;
    export type ClinicsUpdate = Updateable<T>;
  }

  /**
   * Returns a list of all the clinics
   * @returns {Promise<EncodedT>[]} - List of clinics
   */
  export const getAll = serverOnly(async (): Promise<EncodedT[]> => {
    const result = await db
      .selectFrom(Clinic.Table.name)
      .where("is_deleted", "=", false)
      .selectAll()
      .execute();

    return result;
  });

  /**
   * Deletes a clinic given an id, and that the clinic does not have any registered members,
   * If there are registered members, the clinic will not be deleted and an error will be thrown
   * @param {string} id - The id of the clinic to delete
   * @returns {Promise<void>} - Resolves when the clinic is deleted
   * @throws {Error} - If the clinic has registered users
   */
  export const softDelete = serverOnly(async (id: string): Promise<void> => {
    // First check if there are any users registered to this clinic
    const usersInClinic = await db
      .selectFrom(User.Table.name)
      .where("clinic_id", "=", id)
      .where("is_deleted", "=", false)
      .selectAll()
      .execute();

    // If there are users, throw an error
    if (usersInClinic.length > 0) {
      throw new Error(
        `Cannot delete clinic with ID ${id} because it has ${usersInClinic.length} registered users. Please remove or reassign all users before deleting the clinic.`
      );
    }

    // If no users are found, proceed with deletion
    await db
      .updateTable(Clinic.Table.name)
      .set({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .where("id", "=", id)
      .execute();
  });

  /**
   * Updates a clinic given an id and name - if the clinic id is not provided, a new clinic will be created
   * @param {string} id - The id of the clinic to update
   * @param {string} name - The new name of the clinic
   * @returns {Promise<void>} - Resolves when the clinic is updated
   */
  export const save = serverOnly(
    async ({ id, name }: { id?: string; name: string }): Promise<void> => {
      if (typeof id !== "string" || id.length <= 5) {
        const clinicId = uuidV1();
        await db
          .insertInto(Clinic.Table.name)
          .values({
            id: clinicId,
            name,
            is_deleted: false,
            created_at: sql`now()`,
            updated_at: sql`now()`,
            last_modified: sql`now()`,
            server_created_at: sql`now()`,
            deleted_at: null,
          })
          .execute();
      } else {
        await db
          .updateTable(Clinic.Table.name)
          .set({
            name,
          })
          .where("id", "=", id)
          .execute();
      }
    }
  );
}

export default Clinic;
