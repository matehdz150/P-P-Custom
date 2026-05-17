import { Injectable, NotFoundException } from "@nestjs/common";
import { db } from "../db/connection";
import { eq } from "drizzle-orm";

import { productTemplates } from "../../../../packages/db/schema";
import type { CreateTemplateDto } from "./dto/create-template.dto";
import type { UpdateTemplateDto } from "./dto/update-template.dto";

@Injectable()
export class TemplatesService {
  findAll() {
    return db.query.productTemplates.findMany();
  }

  async findOne(id: string) {
    const tpl = await db.query.productTemplates.findFirst({
      where: eq(productTemplates.id, id),
    });

    if (!tpl) {
      throw new NotFoundException("Template no encontrado");
    }

    return tpl;
  }

  async create(dto: CreateTemplateDto) {
    await db.insert(productTemplates).values({
      id: dto.id,
      name: dto.name,
      data: dto.data,
    });

    return { id: dto.id };
  }

  async update(id: string, dto: UpdateTemplateDto) {
    const res = await db
      .update(productTemplates)
      .set({
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.data !== undefined ? { data: dto.data } : {}),
        updatedAt: new Date(),
      })
      .where(eq(productTemplates.id, id))
      .returning({ id: productTemplates.id });

    if (res.length === 0) {
      throw new NotFoundException("Template no encontrado");
    }

    return { ok: true };
  }

  async remove(id: string) {
    const res = await db
      .delete(productTemplates)
      .where(eq(productTemplates.id, id))
      .returning({ id: productTemplates.id });

    if (res.length === 0) {
      throw new NotFoundException("Template no encontrado");
    }

    return { ok: true };
  }
}