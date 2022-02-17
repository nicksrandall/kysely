import { sql } from '../../../'

import {
  BUILT_IN_DIALECTS,
  clearDatabase,
  destroyTest,
  initTest,
  TestContext,
  TEST_INIT_TIMEOUT,
  insertDefaultDataSet,
  testSql,
  NOT_SUPPORTED,
} from './test-setup.js'

for (const dialect of BUILT_IN_DIALECTS) {
  describe(`${dialect}: raw sql`, () => {
    let ctx: TestContext

    before(async function () {
      this.timeout(TEST_INIT_TIMEOUT)
      ctx = await initTest(dialect)
    })

    beforeEach(async () => {
      await insertDefaultDataSet(ctx)
    })

    afterEach(async () => {
      await clearDatabase(ctx)
    })

    after(async () => {
      await destroyTest(ctx)
    })

    it('substitutions should be interpreted as parameters by default', async () => {
      const query = ctx.db
        .selectFrom('person')
        .selectAll()
        .where(sql`first_name between ${'A'} and ${'B'}`)

      testSql(query, dialect, {
        postgres: {
          sql: 'select * from "person" where first_name between $1 and $2',
          parameters: ['A', 'B'],
        },
        mysql: {
          sql: 'select * from `person` where first_name between ? and ?',
          parameters: ['A', 'B'],
        },
        sqlite: {
          sql: 'select * from "person" where first_name between ? and ?',
          parameters: ['A', 'B'],
        },
      })

      await query.execute()
    })

    it('sql.unsafeLiteral should turn substitutions from parameters into literal values', async () => {
      const query = ctx.db
        .selectFrom('person')
        .selectAll()
        .where(
          sql`first_name between ${sql.literal('A')} and ${sql.literal('B')}`
        )

      testSql(query, dialect, {
        postgres: {
          sql: `select * from "person" where first_name between 'A' and 'B'`,
          parameters: [],
        },
        mysql: {
          sql: "select * from `person` where first_name between 'A' and 'B'",
          parameters: [],
        },
        sqlite: {
          sql: `select * from "person" where first_name between 'A' and 'B'`,
          parameters: [],
        },
      })

      await query.execute()
    })

    it('sql.id should turn substitutions from parameters into identifiers', async () => {
      const query = ctx.db
        .selectFrom('person')
        .selectAll()
        .where(sql`${sql.id('first_name')} between ${'A'} and ${'B'}`)

      testSql(query, dialect, {
        postgres: {
          sql: 'select * from "person" where "first_name" between $1 and $2',
          parameters: ['A', 'B'],
        },
        mysql: {
          sql: 'select * from `person` where `first_name` between ? and ?',
          parameters: ['A', 'B'],
        },
        sqlite: {
          sql: 'select * from "person" where "first_name" between ? and ?',
          parameters: ['A', 'B'],
        },
      })

      await query.execute()
    })

    if (dialect == 'postgres') {
      it('sql.id should separate multiple arguments by dots', async () => {
        const query = ctx.db
          .selectFrom('person')
          .selectAll()
          .where(
            sql`${sql.id(
              'public',
              'person',
              'first_name'
            )} between ${'A'} and ${'B'}`
          )

        testSql(query, dialect, {
          postgres: {
            sql: 'select * from "person" where "public"."person"."first_name" between $1 and $2',
            parameters: ['A', 'B'],
          },
          mysql: NOT_SUPPORTED,
          sqlite: NOT_SUPPORTED,
        })

        await query.execute()
      })
    }

    it('sql.ref should turn substitutions from parameters into column references', async () => {
      const query = ctx.db
        .selectFrom('person')
        .selectAll()
        .where(sql`${sql.ref('first_name')} between ${'A'} and ${'B'}`)

      testSql(query, dialect, {
        postgres: {
          sql: 'select * from "person" where "first_name" between $1 and $2',
          parameters: ['A', 'B'],
        },
        mysql: {
          sql: 'select * from `person` where `first_name` between ? and ?',
          parameters: ['A', 'B'],
        },
        sqlite: {
          sql: 'select * from "person" where "first_name" between ? and ?',
          parameters: ['A', 'B'],
        },
      })

      await query.execute()
    })

    if (dialect === 'postgres') {
      it('sql.ref should support schemas and table names', async () => {
        const query = ctx.db
          .selectFrom('person')
          .selectAll()
          .where(
            sql`${sql.ref(
              'public.person.first_name'
            )} between ${'A'} and ${'B'}`
          )

        testSql(query, dialect, {
          postgres: {
            sql: 'select * from "person" where "public"."person"."first_name" between $1 and $2',
            parameters: ['A', 'B'],
          },
          mysql: NOT_SUPPORTED,
          sqlite: NOT_SUPPORTED,
        })

        await query.execute()
      })
    }

    it('sql.table should turn substitutions from parameters into table references', async () => {
      const query = ctx.db
        .selectFrom(sql`${sql.table('person')}`.as('person'))
        .selectAll()

      testSql(query, dialect, {
        postgres: {
          sql: 'select * from "person" as "person"',
          parameters: [],
        },
        mysql: {
          sql: 'select * from `person` as `person`',
          parameters: [],
        },
        sqlite: {
          sql: 'select * from "person" as "person"',
          parameters: [],
        },
      })

      await query.execute()
    })

    if (dialect === 'postgres') {
      it('sql.table should support schemas', async () => {
        const query = ctx.db
          .selectFrom(sql`${sql.table('public.person')}`.as('person'))
          .selectAll()

        testSql(query, dialect, {
          postgres: {
            sql: 'select * from "public"."person" as "person"',
            parameters: [],
          },
          mysql: NOT_SUPPORTED,
          sqlite: NOT_SUPPORTED,
        })

        await query.execute()
      })
    }

    it('sql.join should turn substitutions from parameters into lists of things', async () => {
      const names = ['Jennifer', 'Arnold']

      const query = ctx.db
        .selectFrom('person')
        .selectAll()
        .where(sql`first_name in (${sql.join(names)})`)

      testSql(query, dialect, {
        postgres: {
          sql: 'select * from "person" where first_name in ($1, $2)',
          parameters: names,
        },
        mysql: {
          sql: 'select * from `person` where first_name in (?, ?)',
          parameters: names,
        },
        sqlite: {
          sql: 'select * from "person" where first_name in (?, ?)',
          parameters: names,
        },
      })

      await query.execute()
    })

    if (dialect === 'postgres') {
      it('second argument of sql.join should specify the separator', async () => {
        const names = ['Jennifer', 'Arnold', 'Sylvester']

        const query = ctx.db
          .selectFrom('person')
          .selectAll()
          .where(sql`first_name in (${sql.join(names, sql`::varchar,`)})`)

        testSql(query, dialect, {
          postgres: {
            sql: 'select * from "person" where first_name in ($1::varchar,$2::varchar,$3)',
            parameters: names,
          },
          mysql: NOT_SUPPORTED,
          sqlite: NOT_SUPPORTED,
        })

        await query.execute()
      })
    }
  })
}
