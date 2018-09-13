import { hook } from 'jwit';

import {
  bind,
  getSelector,
  getFirst,
  isNotSelf,
  getHeaders,
  isTrue,
  getFormElementValues,
  areEqual,
} from '../util';

import request from '../request';

function dependencies(element){
  var deps = getFirst([[element, 'deps']]);
  var i, filtered, dep;

  if (deps == null) {
    return [];
  }

  deps = deps.split(/\s+/);
  filtered = [];

  for (i = 0;i < deps.length;i++){
    dep = decodeURIComponent(deps[i]);
    if (dep) {
      filtered.push(dep);
    }
  }

  return filtered;
}

function onBlur(){
  if (isEligible(this)) {
    this.__wookie_committed = true;
    liveUpdate(this, false);
  }
}

function onInput(){
  if (
    !isTrue(getFirst([[this, 'commitonly']])) &&
    shouldBeLiveChecked(this)
  ) {
    liveUpdate(this, false);
  }
}

function isEligible(element){
  if (!(element.form && element.name)) {
    return false;
  }

  if (getFirst([[element, 'wk']]) == null) {
    return false;
  }

  return true;
}

function shouldBeLiveChecked(element){
  if (!isEligible(element)) {
    return false;
  }

  if (
    !element.__wookie_committed &&
    (
      isTrue(getFirst([[element, 'waitcommit']])) ||
      isTrue(getFirst([[element, 'commitonly']]))
    )
  ) {
    return false;
  }

  return true;
}

function liveUpdate(element, debounced){
  var values, debounce, toInclude, toCheck, i, deps, formElem, headers, method, url, body;

  clearTimeout(element.__wookie_debounceTimeout);
  delete element.__wookie_debounceTimeout;

  debounce = getFirst([
    [element, 'debounce'],
    [element.form, 'debounce'],
  ]);

  if (isTrue(debounce) && !debounced) {
    element.__wookie_debounceTimeout = setTimeout(liveUpdate, parseInt(debounce || '0', 10), element, true);
    return;
  }

  values = getFormElementValues(element);
  if (element.__wookie_lastChecked === element.checked && areEqual(element.__wookie_lastValues, values)) {
    return;
  }

  element.__wookie_lastChecked = element.checked;
  element.__wookie_lastValues = values;

  toInclude = {};
  toCheck = {};

  function add(elem, deps){
    var i;

    toInclude[elem.name] = true;
    toCheck[elem.name] = true;
    for (i = 0;i < deps.length;i++) {
      toInclude[deps[i]] = true;
    }
  }

  add(element, dependencies(element));

  for(i = 0;i < element.form.elements.length;i++){
    formElem = element.form.elements[i];
    if (shouldBeLiveChecked(formElem)) {
      deps = dependencies(formElem);
      if (deps.indexOf(element.name) != -1) {
        add(formElem, deps);
      }
    }
  }

  headers = {};
  headers['X-Live'] = keys(toCheck).join(',');
  getHeaders(element.form, '-header', headers);
  getHeaders(element.form, '-liveheader', headers);

  method = getFirst([
    [element.form, 'livemethod'],
    [element.form, 'method'],
  ]) || 'GET';

  url = getFirst([
    [element.form, 'liveaction'],
    [element.form, 'action'],
  ]) || location.href;

  if (method.toLowerCase() == 'get') {
    body = null;
    url = getValues(url, keys(toInclude), element.form);
  } else {
    if (!window.FormData) {
      return;
    }

    body = getValues(null, keys(toInclude), element.form);
  }

  request({
    url,
    headers,
    method,
    body,
    asynchronous: isTrue( getFirst([
      [element.form, 'liveasync'],
      [element.form, 'async'],
    ]) )
  })();
}

export function commit(element){
  onBlur.call(element)
}

export function notifyChange(element){
  onInput.call(element)
}

hook(`${getSelector('input')}, ${getSelector('textarea')}, ${getSelector('select')}`, function(input){
  bind(input, 'change', onBlur)
  bind(input, 'blur', onBlur)
  bind(input, 'input', onInput)
});
