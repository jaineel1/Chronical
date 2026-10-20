import { Link, useNavigate } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import type { BookStatus } from '@/data/types';
import { Button, Empty, SectionHeader } from '@/ui/primitives';
import { bookRepo } from '../lib/repos';
import { useBooksAll } from '../queries';

export const BOOK_STATUSES: readonly BookStatus[] = ['reading', 'wishlist', 'done'];
export const BOOK_STATUS_LABEL: Record<BookStatus, string> = { reading: 'Reading', wishlist: 'Wishlist', done: 'Done' };

export function BookList() {
  const books = useBooksAll();
  const navigate = useNavigate();
  const reading = books?.filter((b) => b.book.status === 'reading').length ?? 0;
  useShellBar('Books', books ? `${reading} reading` : undefined);
  if (!books) return <Page>{null}</Page>;

  return (
    <Page>
      {books.length === 0 ? <Empty>Add the book you are reading; its lessons show up at the campfire.</Empty> : null}
      {BOOK_STATUSES.map((status) => {
        const list = books.filter((b) => b.book.status === status);
        if (!list.length) return null;
        return (
          <section key={status} aria-label={BOOK_STATUS_LABEL[status]} className="flex flex-col gap-2 pb-2">
            <SectionHeader title={BOOK_STATUS_LABEL[status]} note={`${list.length} ${list.length === 1 ? 'book' : 'books'}`} />
            <ul className="m-0 flex list-none flex-col p-0 px-2.5">
              {list.map(({ book, lessons }, i) => (
                <li key={book.id} className={`flex items-baseline gap-3 ${i ? 'border-t border-faint' : ''}`}>
                  <Link to={`/edit/books/${book.id}`} className="flex min-w-0 flex-1 items-baseline justify-between gap-3 py-2 text-ink no-underline">
                    <span className="flex min-w-0 flex-col">
                      <span>{book.title}</span>
                      {book.author ? <span className="text-mid">{book.author}</span> : null}
                    </span>
                    <span className="shrink-0 text-mid">
                      {BOOK_STATUS_LABEL[book.status].toLowerCase()}, {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
                    </span>
                  </Link>
                  <Button
                    variant="text"
                    className="shrink-0"
                    aria-label={book.status === 'reading' ? `Mark ${book.title} done` : `Reading ${book.title} now`}
                    onClick={() => void bookRepo.update(book.id, { status: book.status === 'reading' ? 'done' : 'reading' })}
                  >
                    {book.status === 'reading' ? 'Done reading' : 'Reading now'}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <div className="px-2.5 pt-1">
        <Button onClick={() => navigate('/edit/books/new')}>Add a book</Button>
      </div>
    </Page>
  );
}
