import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarBlank,
  Compass,
  CurrencyCircleDollar,
  Hammer,
  ListChecks,
  MagnifyingGlass,
  SignIn,
  SquaresFour,
  User,
  UserPlus,
  Users,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import Sidebar from '../components/dashboard/Sidebar'
import { Icon } from '../components/dashboard/icons'
import { HELP_CATEGORIES, findHelpArticle, helpArticles, type HelpCategory } from '../lib/helpData'
import './Dashboard.css'
import './HelpCenter.css'

const ARTICLE_ICONS: Record<string, PhosphorIcon> = {
  signIn: SignIn,
  compass: Compass,
  dashboard: SquaresFour,
  assign: UserPlus,
  calendar: CalendarBlank,
  jobs: Hammer,
  cost: CurrencyCircleDollar,
  crew: Users,
  timesheet: ListChecks,
  profile: User,
}

function ArticleView({ id }: { id: string }) {
  const navigate = useNavigate()
  const article = findHelpArticle(id)

  if (!article) {
    return (
      <div className="help-empty help-empty--page">
        <h2>We couldn’t find that article</h2>
        <p>It may have been renamed or removed.</p>
        <button type="button" className="btn btn--primary" onClick={() => navigate('/help-center')}>
          Back to Help Center
        </button>
      </div>
    )
  }

  const index = helpArticles.findIndex((a) => a.id === article.id)
  const prev = helpArticles[index - 1]
  const next = helpArticles[index + 1]
  const ArticleIcon = ARTICLE_ICONS[article.icon] ?? Compass

  return (
    <>
      <button type="button" className="help-back" onClick={() => navigate('/help-center')}>
        <ArrowLeft size={16} weight="regular" />
        All articles
      </button>

      <article className="help-article">
        <header className="help-article__head">
          <span className="help-article__icon">
            <ArticleIcon size={24} weight="regular" />
          </span>
          <div>
            <span className="help-chip">{article.category}</span>
            <h1 className="help-article__title">{article.title}</h1>
            <p className="help-article__summary">{article.summary}</p>
            <p className="help-article__meta">
              {article.steps.length} steps &middot; about {article.minutes} min read
            </p>
          </div>
        </header>

        <p className="help-article__intro">{article.intro}</p>

        <ol className="help-steps">
          {article.steps.map((step, i) => (
            <li className="help-step" key={step.title}>
              <span className="help-step__number" aria-hidden>
                {i + 1}
              </span>
              <div className="help-step__body">
                <h2>{step.title}</h2>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {article.tips && article.tips.length > 0 && (
          <aside className="help-tips">
            <h2>Good to know</h2>
            <ul>
              {article.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </aside>
        )}
      </article>

      <nav className="help-article-nav" aria-label="Other articles">
        {prev ? (
          <button type="button" className="help-article-nav__link" onClick={() => navigate(`/help-center/${prev.id}`)}>
            <span>Previous</span>
            <strong>{prev.title}</strong>
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button
            type="button"
            className="help-article-nav__link help-article-nav__link--next"
            onClick={() => navigate(`/help-center/${next.id}`)}
          >
            <span>Next</span>
            <strong>{next.title}</strong>
          </button>
        )}
      </nav>
    </>
  )
}

function ArticleGrid() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<HelpCategory | null>(null)

  const results = useMemo(() => {
    const term = search.trim().toLowerCase()
    return helpArticles.filter((a) => {
      const matchesCategory = !category || a.category === category
      const matchesSearch =
        !term || a.title.toLowerCase().includes(term) || a.summary.toLowerCase().includes(term)
      return matchesCategory && matchesSearch
    })
  }, [search, category])

  return (
    <>
      <div className="help-toolbar">
        <label className="help-search">
          <MagnifyingGlass size={16} weight="regular" />
          <input
            placeholder="Search help articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <div className="help-filters" role="tablist" aria-label="Article categories">
          <button
            type="button"
            className={`help-filter ${category === null ? 'is-active' : ''}`}
            onClick={() => setCategory(null)}
          >
            All
          </button>
          {HELP_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`help-filter ${category === c ? 'is-active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {results.length === 0 ? (
        <div className="help-empty">
          <h2>No articles match “{search}”</h2>
          <p>Try a different word, or browse a category above.</p>
        </div>
      ) : (
        <div className="help-grid">
          {results.map((article) => {
            const ArticleIcon = ARTICLE_ICONS[article.icon] ?? Compass
            return (
              <button
                type="button"
                className="help-card"
                key={article.id}
                onClick={() => navigate(`/help-center/${article.id}`)}
              >
                <span className="help-card__icon">
                  <ArticleIcon size={20} weight="regular" />
                </span>
                <span className="help-chip">{article.category}</span>
                <h2 className="help-card__title">{article.title}</h2>
                <p className="help-card__summary">{article.summary}</p>
                <span className="help-card__footer">
                  <span className="help-card__meta">
                    {article.steps.length} steps &middot; {article.minutes} min
                  </span>
                  <span className="help-card__cta">
                    Read
                    <Icon.ChevronRight width={14} height={14} />
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

export default function HelpCenter() {
  const { articleId } = useParams()

  return (
    <div className="dash help-page">
      <Sidebar active="Help Center" />

      <main className="dash__main help-page__main">
        {articleId ? (
          <ArticleView id={articleId} />
        ) : (
          <>
            <div className="help-page__header">
              <h1 className="dash__title help-page__title">Help Center</h1>
              <p className="dash__subtitle">
                Step-by-step walkthroughs for every part of the app. Pick a topic to get started.
              </p>
            </div>
            <ArticleGrid />
          </>
        )}
      </main>
    </div>
  )
}
