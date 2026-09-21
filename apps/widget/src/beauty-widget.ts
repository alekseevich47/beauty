import { DEMO_SERVICES, loadServices, submitBooking, type WidgetService } from './book-flow';
import { widgetStyles } from './styles';

type Step = 'list' | 'form' | 'done';

export class BeautyWidget extends HTMLElement {
  static observedAttributes = ['public-key', 'api-base'];

  #shadow: ShadowRoot;
  #step: Step = 'list';
  #services: WidgetService[] = [];
  #selected: WidgetService | null = null;
  #error = '';
  #appointmentId = '';
  #loading = false;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    void this.#bootstrap();
  }

  attributeChangedCallback() {
    if (this.isConnected) void this.#bootstrap();
  }

  get publicKey(): string {
    return this.getAttribute('public-key') ?? '';
  }

  get apiBase(): string {
    return this.getAttribute('api-base') ?? '';
  }

  async #bootstrap() {
    this.#loading = true;
    this.#error = '';
    this.#render();
    try {
      if (!this.publicKey) {
        this.#error = 'Attribute public-key is required';
        this.#services = [];
      } else {
        this.#services = await loadServices(this.publicKey, this.apiBase);
      }
    } catch (e) {
      this.#error = e instanceof Error ? e.message : 'Load error';
      this.#services = DEMO_SERVICES;
    } finally {
      this.#loading = false;
      this.#render();
    }
  }

  #render() {
    this.#shadow.innerHTML = '';
    const style = document.createElement('style');
    style.textContent = widgetStyles;
    this.#shadow.append(style);

    const root = document.createElement('div');
    root.className = 'bw-root';
    root.innerHTML = `
      <h2 class="bw-brand">Beauty+</h2>
      <p class="bw-sub">Онлайн-запись к мастеру</p>
    `;

    if (this.#error && this.#step === 'list') {
      const err = document.createElement('p');
      err.className = 'bw-error';
      err.textContent = this.#error;
      root.append(err);
    }

    if (this.#loading) {
      const p = document.createElement('p');
      p.className = 'bw-sub';
      p.textContent = 'Загрузка…';
      root.append(p);
    } else if (this.#step === 'list') {
      root.append(this.#renderList());
    } else if (this.#step === 'form' && this.#selected) {
      root.append(this.#renderForm(this.#selected));
    } else if (this.#step === 'done') {
      const ok = document.createElement('p');
      ok.className = 'bw-ok';
      ok.textContent = `Запись создана · ${this.#appointmentId}`;
      root.append(ok);
      const actions = document.createElement('div');
      actions.className = 'bw-actions';
      const again = document.createElement('button');
      again.className = 'bw-btn bw-btn-primary';
      again.type = 'button';
      again.textContent = 'Новая запись';
      again.addEventListener('click', () => {
        this.#step = 'list';
        this.#selected = null;
        this.#appointmentId = '';
        this.#render();
      });
      actions.append(again);
      root.append(actions);
    }

    const keyHint = document.createElement('p');
    keyHint.className = 'bw-key';
    keyHint.textContent = this.publicKey ? `pk: ${this.publicKey}` : 'missing public-key';
    root.append(keyHint);

    this.#shadow.append(root);
  }

  #renderList(): HTMLElement {
    const list = document.createElement('ul');
    list.className = 'bw-list';
    for (const s of this.#services) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bw-item';
      btn.innerHTML = `
        <div>
          <strong>${escapeHtml(s.title)}</strong>
          <span>${escapeHtml(s.masterName)} · ${s.durationMin} мин</span>
        </div>
        <div class="bw-price">${s.price.toLocaleString('ru-RU')} ₽</div>
      `;
      btn.addEventListener('click', () => {
        this.#selected = s;
        this.#step = 'form';
        this.#error = '';
        this.#render();
      });
      li.append(btn);
      list.append(li);
    }
    return list;
  }

  #renderForm(service: WidgetService): HTMLElement {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <p class="bw-sub">${escapeHtml(service.title)} · ${service.price.toLocaleString('ru-RU')} ₽</p>
      <label class="bw-field">Имя<input name="clientName" required minlength="2" placeholder="Анна" /></label>
      <label class="bw-field">Телефон<input name="phone" required minlength="10" placeholder="+7…" /></label>
      <label class="bw-field">Дата и время<input name="startsAt" type="datetime-local" required /></label>
      <label class="bw-field">Комментарий<input name="note" maxlength="500" placeholder="Необязательно" /></label>
    `;

    if (this.#error) {
      const err = document.createElement('p');
      err.className = 'bw-error';
      err.textContent = this.#error;
      wrap.append(err);
    }

    const actions = document.createElement('div');
    actions.className = 'bw-actions';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'bw-btn bw-btn-ghost';
    back.textContent = 'Назад';
    back.addEventListener('click', () => {
      this.#step = 'list';
      this.#selected = null;
      this.#error = '';
      this.#render();
    });

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'bw-btn bw-btn-primary';
    submit.textContent = 'Записаться';
    submit.addEventListener('click', () => void this.#onSubmit(wrap, service));

    actions.append(back, submit);
    wrap.append(actions);
    return wrap;
  }

  async #onSubmit(wrap: HTMLElement, service: WidgetService) {
    const name =
      (wrap.querySelector('[name="clientName"]') as HTMLInputElement | null)?.value ?? '';
    const phone = (wrap.querySelector('[name="phone"]') as HTMLInputElement | null)?.value ?? '';
    const local = (wrap.querySelector('[name="startsAt"]') as HTMLInputElement | null)?.value ?? '';
    const note = (wrap.querySelector('[name="note"]') as HTMLInputElement | null)?.value ?? '';

    const startsAt = local ? new Date(local).toISOString() : '';
    try {
      const result = await submitBooking(
        {
          publicKey: this.publicKey,
          serviceId: service.id,
          clientName: name,
          phone,
          startsAt,
          note: note || undefined,
        },
        this.apiBase,
      );
      this.#appointmentId = result.appointmentId;
      this.#step = 'done';
      this.#error = '';
      this.dispatchEvent(
        new CustomEvent('beauty-booked', {
          detail: result,
          bubbles: true,
          composed: true,
        }),
      );
    } catch (e) {
      this.#error = e instanceof Error ? e.message : 'Validation error';
    }
    this.#render();
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
