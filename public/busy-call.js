const $ = selector => document.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

// Parse prospect customization parameters from URL:
// Example: ?biz=Brozzetti%27s%20Pizza&phone=607-797-9960
const params = new URLSearchParams(window.location.search);
const rawBiz = (params.get('biz') || '').trim();
const rawPhone = (params.get('phone') || '').trim();
const rawMenu = (params.get('menu') || '').trim();

const biz = rawBiz || 'Local Restaurant';
const phone = rawPhone || '(607) 555-0199';
const cleanPhone = phone.replace(/[^0-9+]/g, '');

// Personalize page copy if custom biz provided
if (rawBiz) {
  $('#pageTitle').textContent = `${biz} · Busy-Line Recovery Demo`;
  $('#heroEyebrow').textContent = `Demo for ${biz} · Interactive Prototype`;
  $('#heroHeading').textContent = biz;
  $('#heroSub').textContent = `See how busy Friday dinner-rush phone calls at ${biz} are automatically saved.`;
  $('#brandMark').textContent = biz.charAt(0).toUpperCase();
}
if (rawPhone) {
  $('#heroPhoneLabel').textContent = phone;
  $('#heroCallLink').setAttribute('href', `tel:${cleanPhone}`);
  $('#ctaCall').setAttribute('href', `tel:${cleanPhone}`);
}
$('#ctaContact').setAttribute('href', `mailto:coden607@gmail.com?subject=Busy-Line%20Recovery%20Free%20Trial%20for%20${encodeURIComponent(biz)}`);

// Missed-call flow simulation states
const simSteps = {
  idle: {
    label: 'Step 1 of 5',
    caption: `It is the Friday dinner rush and lines are tied up. A hungry customer calls ${biz} at ${phone}.`,
    screen: `<p class="sim-title">Phone</p><p class="sim-big">${escapeHtml(biz)}</p><p>${escapeHtml(phone)}</p>`,
    next: 'Start: a customer calls'
  },
  busy: {
    label: 'Step 1 of 5',
    caption: `The line is busy. Today, this customer hangs up, and most call a competitor or order through a high-fee app.`,
    screen: `<p class="sim-title">Calling…</p><p class="sim-big">${escapeHtml(biz)}</p><p class="sim-alert">Line busy</p>`,
    next: 'Next: carrier forwards call'
  },
  forward: {
    label: 'Step 2 of 5',
    caption: `Carrier busy-forwarding routes the engaged call to your automated recovery responder. Your published number never changes.`,
    screen: `<p class="sim-title">Forwarding…</p><p class="sim-big">${escapeHtml(biz)}</p><p>Connecting to text-back</p>`,
    next: 'Next: customer hears greeting'
  },
  prompt: {
    label: 'Step 3 of 5',
    caption: `A friendly, short greeting plays: "Thanks for calling ${biz}! We're currently taking orders. Press 1 and we'll text you our menu & direct order link."`,
    screen: `<p class="sim-title">${escapeHtml(biz)} · on call</p><p class="sim-quote">“Thanks for calling ${escapeHtml(biz)}. We’re busy right now. Press 1 and we’ll text you our menu link.”</p><div class="sim-keypad" aria-hidden="true"><span>1</span><span>2</span><span>3</span></div>`
  },
  sms: {
    label: 'Step 4 of 5',
    caption: `An instant text arrives because the customer pressed 1. They receive your menu link and tap-to-call button. Replying STOP opts out.`,
    screen: `<p class="sim-title">Messages · ${escapeHtml(biz)}</p><div class="sim-bubble">${escapeHtml(biz)}: Sorry we missed your call! View our menu: ${escapeHtml(rawMenu || 'online-menu')}. Call ${escapeHtml(phone)} to order as soon as our line clears. Reply STOP to opt out.</div><p class="sim-small">Sample text</p>`,
    next: 'Next: customer orders'
  },
  order: {
    label: 'Step 5 of 5',
    caption: `The customer browses your menu on their phone and calls right back as soon as your line frees up—recovering a $42 takeout order.`,
    screen: `<p class="sim-title">Menu opened</p><p class="sim-big">Ready to order</p><p>Calls ${escapeHtml(phone)}</p>`
  },
  declined: {
    label: 'Step 4 of 5',
    caption: `If the customer doesn't press 1, a polite voice message plays and no text is sent.`,
    screen: `<p class="sim-title">${escapeHtml(biz)} · on call</p><p class="sim-quote">“No problem! Please call us back in a few minutes. Thank you!”</p>`
  }
};

const simOrder = {
  idle: 'busy',
  busy: 'forward',
  forward: 'prompt',
  sms: 'order'
};

let simState = 'idle';

function renderSim(moveFocus) {
  const step = simSteps[simState];
  $('#simStepLabel').textContent = step.label;
  $('#simCaption').textContent = step.caption;
  $('#simScreen').innerHTML = step.screen;
  $('#simScreen').dataset.state = simState;
  $('#simNext').hidden = !step.next;
  if (step.next) $('#simNext').textContent = step.next;
  $('#simKey1').hidden = $('#simDecline').hidden = (simState !== 'prompt');
  $('#simRestart').hidden = (simState === 'idle');
  if (moveFocus && (!document.activeElement || document.activeElement.hidden || document.activeElement === document.body)) {
    $('#simCaption').focus();
  }
}

function goSim(state) {
  simState = state;
  renderSim(true);
}

$('#simNext').addEventListener('click', () => goSim(simOrder[simState] || 'idle'));
$('#simKey1').addEventListener('click', () => goSim('sms'));
$('#simDecline').addEventListener('click', () => goSim('declined'));
$('#simRestart').addEventListener('click', () => goSim('idle'));

renderSim(false);
