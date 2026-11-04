import { useMemo, useState } from 'react'
import {
  Layers3,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react'

export type CatalogFieldValue =
  | string
  | number
  | boolean
  | null

export type CatalogItem = {
  id: string
  name: string
  type?: string
  category?: string
  code?: string
  priceLabel?: string
  description?: string
  customFields?: Record<string, CatalogFieldValue>
}

export type CatalogColumn = {
  key: string
  label: string
}

export type ProductsPageProps = {
  items?: readonly CatalogItem[]
  columns?: readonly CatalogColumn[]
  onCreate?: () => void
  onOpen?: (item: CatalogItem) => void
}

const defaultColumns: readonly CatalogColumn[] = [
  { key: 'name', label: 'Product / Service' },
  { key: 'type', label: 'Type' },
  { key: 'category', label: 'Category' },
  { key: 'code', label: 'Code' },
  { key: 'priceLabel', label: 'Price' },
]

function displayValue(
  item: CatalogItem,
  key: string,
): string {
  const standardFields: Record<string, CatalogFieldValue> = {
    name: item.name,
    type: item.type ?? null,
    category: item.category ?? null,
    code: item.code ?? null,
    priceLabel: item.priceLabel ?? null,
    description: item.description ?? null,
  }

  const value = Object.prototype.hasOwnProperty.call(
    standardFields,
    key,
  )
    ? standardFields[key]
    : item.customFields?.[key]

  if (value === null || value === undefined || value === '') {
    return '—'
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  return String(value)
}

export default function ProductsPage({
  items = [],
  columns,
  onCreate,
  onOpen,
}: ProductsPageProps) {
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const visibleColumns =
    columns && columns.length > 0
      ? columns
      : defaultColumns

  const types = useMemo(() => {
    const values = items
      .map((item) => item.type?.trim())
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.length > 0,
      )

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [items])

  const categories = useMemo(() => {
    const values = items
      .map((item) => item.category?.trim())
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.length > 0,
      )

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [items])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()

    return items.filter((item) => {
      if (
        selectedType !== 'all' &&
        item.type !== selectedType
      ) {
        return false
      }

      if (
        selectedCategory !== 'all' &&
        item.category !== selectedCategory
      ) {
        return false
      }

      const searchable = [
        item.name,
        item.type ?? '',
        item.category ?? '',
        item.code ?? '',
        item.description ?? '',
        ...Object.values(item.customFields ?? {}).map(
          (value) => String(value ?? ''),
        ),
      ]
        .join(' ')
        .toLocaleLowerCase()

      return searchable.includes(query)
    })
  }, [items, search, selectedType, selectedCategory])

  return (
    <main className="products-page">
      <header className="products-page__header">
        <div>
          <p className="products-page__eyebrow">
            D-GATE / SILVER CRM
          </p>

          <h1>Products &amp; Services</h1>

          <p className="products-page__description">
            Manage your company's product and service catalog
            with configurable categories and fields.
          </p>
        </div>

        <button
          type="button"
          className="products-page__create-button"
          disabled={!onCreate}
          onClick={onCreate}
        >
          <Plus size={18} aria-hidden="true" />
          Add Product / Service
        </button>
      </header>

      <section
        className="products-page__section"
        aria-labelledby="products-directory-title"
      >
        <div className="products-page__section-heading">
          <div>
            <h2 id="products-directory-title">
              Product &amp; Service Catalog
            </h2>

            <p>
              Browse offerings available to your workspace.
            </p>

            <span className="products-page__record-count">
              {filteredItems.length} of {items.length} records
            </span>
          </div>

          <Package size={22} aria-hidden="true" />
        </div>

        <div className="products-page__toolbar">
          <label className="products-page__search">
            <Search size={18} aria-hidden="true" />

            <span className="products-page__sr-only">
              Search products and services
            </span>

            <input
              type="search"
              placeholder="Search products and services..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="products-page__filter">
            <Layers3 size={18} aria-hidden="true" />

            <span className="products-page__sr-only">
              Filter by type
            </span>

            <select
              value={selectedType}
              onChange={(event) =>
                setSelectedType(event.target.value)
              }
            >
              <option value="all">All types</option>

              {types.map((type) => (
                <option value={type} key={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="products-page__filter">
            <SlidersHorizontal size={18} aria-hidden="true" />

            <span className="products-page__sr-only">
              Filter by category
            </span>

            <select
              value={selectedCategory}
              onChange={(event) =>
                setSelectedCategory(event.target.value)
              }
            >
              <option value="all">All categories</option>

              {categories.map((category) => (
                <option value={category} key={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filteredItems.length > 0 ? (
          <div className="products-page__table-wrap">
            <table className="products-page__table">
              <thead>
                <tr>
                  {visibleColumns.map((column) => (
                    <th scope="col" key={column.key}>
                      {column.label}
                    </th>
                  ))}
                  <th scope="col">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    {visibleColumns.map((column) => (
                      <td key={column.key}>
                        {column.key === 'name' ? (
                          <div className="products-page__item-name">
                            <strong>{item.name}</strong>

                            {item.description && (
                              <span>
                                {item.description}
                              </span>
                            )}
                          </div>
                        ) : (
                          displayValue(item, column.key)
                        )}
                      </td>
                    ))}

                    <td>
                      <button
                        type="button"
                        className="products-page__open-button"
                        disabled={!onOpen}
                        onClick={() => onOpen?.(item)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="products-page__empty-state">
            <Package size={38} aria-hidden="true" />

            <h3>
              {items.length === 0
                ? 'No products or services available'
                : 'No matching products or services'}
            </h3>

            <p>
              {items.length === 0
                ? 'Authorized product and service records will appear here when your catalog is connected.'
                : 'Try a different search term or filter.'}
            </p>
          </div>
        )}
      </section>
    </main>
  )
}