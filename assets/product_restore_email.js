
(function() {
  /**
   * 1.0 与 2.0脚本的主要区别如下
   * @param {shopId} - 获取都在init()中，但是操作略有不同
   * @function (renderButton) - 1.0是insertAdjacentHTML, 2.0由于是挂在到liquid，主要采取替换innerHTML
   *
   *
   */
  // warning ： .shopify-payment-button 字符串被用于替换做兼容
  // 防抖
  function debounce(delay = 500, callback) {
    let timer;
    return function() {
      clearTimeout(timer);
      timer = null;
      timer = setTimeout(() => {
        callback();
      }, delay);
    };
  };
  const domain = Shopify.shop;
  const initRes = init();
  if (typeof initRes === 'string') {
    console.log('Init info: ', initRes);
    return; // 如果获得的返回值不是对象而是string，说明在中间的某一个if判断出问题了，应当直接return
  } else {
    importStyles(); // 引入邮件的css
    console.log('App is on!');
  }
  const { debug, shopId, baseUrl, MAX_SEARCH_TIMES } = initRes;
  let { times } = initRes;

  // 按钮以及弹窗的参数
  const btnAndPopupData = initBtnAndPopupData();
  const {
    buttonStyleUrl,
    popupStyleUrl,
    integrationUrl,
    floatBtnPosition,
    buttonData,
    generalData,
    formAction } = btnAndPopupData;
  let {
    iti,
    popupData,
    inlineBtnHeight,
    inlineBtnWidth,
    btnRadius,
    btnFontSize,
    btnFontWeight,
    insertEl,
    insertType,
    selectedType,
    selBtnStatus,
    btnStyleSwitch,
    popupStyleSwitch,
    inteStatus } = btnAndPopupData;

  const elements = initElement();
  let {
    inlineBtnElement,
    floatBtnElement,
    emailFrameElement,
    inlineEmailDiv,
    floatEmailDiv,
    invalidTip,
    successFrame,
    variantSelector,
    closeBox,
    submitBtn,
    emailInput,
    nameInput,
    smsInput,
    mailingCheckbox,
    soldOutBtn,
    exactForm } = elements;
  const { trueForms } = elements;

  const productInfo = initProductInfo();
  let {
    currentVariant,
    available,
    selectVariantId,
    productTitle,
    currentVariantOption,
    addOptionsStatus,
    initUrl,
    listenVariantFlag
  } = productInfo;
  const { variantData, unVariantOptions } = productInfo;

  const payment_button_class = '.shopify-payment-button';
  debug && console.log('Init data finished');
  searchParentEl().then(res => {
    debug && console.log('SearchParentEl finished')
    const { code } = res;
    if (code === 501) { // 没有找到元素，打印出来，方便人员调试
      console.log('Search Node Failed');
      handleSearchNodeFailed().then(searchRes => {
        if (searchRes.code === 200) {
          handleBasicData();
          getAllStyle();
        }
      })
      return;
    }
    if (code === 200) { // 找到了插入的元素，继续往下执行
      debug && console.log('SearchParentEl success')
      handleBasicData();
      getAllStyle();
    }
  })
  ;
  getUserConfig();
  // =====================================逻辑就到这里结束====================================
  // =====================================逻辑就到这里结束====================================
  // =====================================逻辑就到这里结束====================================

  function init() {
    /*
      * 初始化一些店铺的信息，判断是否要继续往下执行脚本
      * shopId - 店铺id，长的那个，不是user表里短的那个
      * ENV - dev下debug为true, baseUrl为测试服。
      *       prod下debug为false, baseUrl为正式服
      */

    const ENV = 'prod';
    const baseUrl = ENV.indexOf('dev') === -1
        ? 'https://emailnoticeapi.sealapps.com/'
        : 'https://emailnoticeapitest.sealapps.com/';
    const debug = ENV.indexOf('dev') !== -1;

    // 从浏览器的window对象中获取ShopifyAnalytics对象
    const { ShopifyAnalytics } = window;
    if (ShopifyAnalytics && ShopifyAnalytics.meta && ShopifyAnalytics.meta.page && ShopifyAnalytics.meta.page.pageType !== 'product') {
      return 'Not in product page';
    } else if (location.href.indexOf('product') === -1) {
      return 'Not in product page';
    }
    // 获取shopId

    const shopId = JSON.parse(qa('#shopify-features')[0].outerText).shopId
    // const shopId = ShopifyAnalytics.lib
    //   ? JSON.parse(qa('#shopify-features')[0].outerText).shopId
    //   : ShopifyAnalytics.lib.config.Trekkie.defaultAttributes.shopId;
    changeStatus({ shopId, baseUrl });
    // 这里似乎是判断用户是否卸载的，但是偶尔会影响到正常用户，故注释
    // const timeStamp = +new Date() / 1000;
    // if (timeStamp - 7200 > shopMeta) {
    //   return 'Time stamp';
    // }

    // const shopMeta = JSON.parse(q('#em_product_metafields').textContent);
    // if (!shopMeta) {
    //   return 'no shopMeta';
    // }

    const variantData = JSON.parse(q('#em_product_variants').textContent);
    const hasUnavailableV = variantData.some(v => v.available === false);
    if (!hasUnavailableV) {
      return 'All variants are in stock.'
    }

    if (
        q('#product-restore-email-flag') ||
        q('#product-restore-email-float') ||
        q('#product-restore-email')) {
      return 'Already enabled';
    } else {
      const div = `
      <div id="product-restore-email-flag" style="display: none;"></div>
      `;
      document.body.insertAdjacentHTML('beforeend', div);
    }
    return {
      debug,
      shopId,
      baseUrl,
      MAX_SEARCH_TIMES: 50,
      times: 0
    };
  }

  function initProductInfo() {
    /*
      * 初始化一些店铺的信息，比如
      * variantData - 该产品所有的变体信息数组
      * currentVariant - 当前/默认选中的变体，偶尔可能会与实际情况有差别
      * available - 当前变体是否available
      * selectVariantId - 被选中的变体的id
      * hasAvailableV - 是否有缺货的变体
      * unVariantOptions - 缺货的变体，用于之后生成弹窗中的select的options
      * currentVariantOption - 当前选中的变体
      * addOptionsStatus - 似乎是用于记录是否选择了变体的状态
      */
    const variantData = JSON.parse(q('#em_product_variants').textContent);
    const hasAvailableV = variantData.some(v => v.available === false);
    const currentVariant = JSON.parse(
        q('#em_product_selected_or_first_available_variant').textContent
    );
    return {
      variantData,
      currentVariant,
      available: currentVariant.available,
      selectVariantId: currentVariant.id,
      hasAvailableV,
      productTitle: '',
      unVariantOptions: [],
      currentVariantOption: null,
      addOptionsStatus: 0,
      initUrl: document.URL,
      listenVariantFlag: true
    };
  }

  function initBtnAndPopupData() {
    // 初始化按钮以及弹窗的相关数据
    return {
      btnRadius: '',
      btnFontSize: '',
      inlineBtnWidth: '',
      inlineBtnHeight: '',
      btnFontWeight: 'initial',
      popupStyleUrl: 'getPopupStyle',
      buttonStyleUrl: 'getButtonStyle',
      integrationUrl: 'integrate/getIntegration',
      floatBtnPosition: 'float-btn-right',
      buttonData: {
        btn_value: '',
        btn_color: '',
        font_color: '',
        btn_margin_top: '',
        inline_status: 0,
        float_btn_value: '',
        float_btn_color: '',
        float_font_color: '',
        btn_insert_customized: 0,
        btn_insert_el: '',
        btn_insert_type: '',
        offset: 0,
        float_status: 0,
        is_branding_removed: 0
      },
      generalData: {
        btn_display_all: 0, // 只要有一个变体缺货，展示给所有变体
        btn_font_family: 'inherit',
        btn_font_size: '14',
        btn_font_weight: 'inherit',
        btn_hover_animation: 0,
        btn_hover_color: '#333333',
        btn_hover_font_color: '#ffffff',
        btn_margin_top: '0',
        btn_border_radius: '0',
        btn_border_color: 'transparent'
      },
      popupData: null,
      frameBtnColor: '#333333',
      frameBtnFontColor: '#ffffff',
      insertType: '',
      insertEl: null,
      selectedType: {},
      iti: null, // intl-phone-input插件
      selBtnStatus: 0, // selBtnStatus返回情况
      btnStyleSwitch: 0, // buttonStyle是否请求成功
      popupStyleSwitch: 0, // popupStyle是否请求成功
      inteStatus: 0, // 是否开启集成商
      formAction: 'https://' + document.domain + '/cart/add' // 用于验证form表单的action
    };
  }

  function initElement() {
    return {
      inlineBtnElement: null,
      floatBtnElement: null,
      emailFrameElement: null,
      inlineEmailDiv: null,
      floatEmailDiv: null,
      invalidTip: null,
      successFrame: null,
      variantSelector: null,
      closeBox: null,
      submitBtn: null,
      soldOutBtn: null,
      emailInput: null,
      nameInput: null,
      smsInput: null,
      mailingCheckbox: null,
      trueForms: [],
      exactForm: null
    };
  }

  // 获取按钮样式
  function getBtnStyle(btn) {
    if (btn.tagName == 'DIV') {
      btn = btn.querySelector('button');
    }
    if (!btn) {
      return;
    }
    const btnStyle = window.getComputedStyle(btn, null);
    if (btnStyle.width == 'auto' || !btnStyle.width) {
      inlineBtnWidth = '';
    } else if (btnStyle.width.indexOf('px') !== -1) {
      if (parseFloat(btnStyle.width) > 120) {
        inlineBtnWidth = btnStyle.width;
      }
    }
    if (btnStyle.height == 'auto' || !btnStyle.height) {
      inlineBtnHeight = '';
    } else {
      inlineBtnHeight = btnStyle.height;
    }
    btnRadius = btnStyle.borderRadius;
    btnFontSize = btnStyle.fontSize;
    btnFontWeight = btnStyle.fontWeight;
  }

  // 获取soldout按钮以及样式
  function getSoldOutBtn(trueForm) {
    const btnArr = trueForm.querySelectorAll('button');
    const iptArr = [
      ...trueForm.querySelectorAll("input[type='submit']"),
      ...trueForm.querySelectorAll("input[type='button']")];
    const allArr = [...btnArr, ...iptArr];
    if (allArr.length) {
      for (let i = 0; i < allArr.length; i++) {
        if (allArr[i].type == 'submit' &&
            allArr[i].name == 'add' ||
            allArr[i].type == 'submit' &&
            allArr[i].name == 'button') {
          soldOutBtn = allArr[i];
          break;
        }
      }
      if (!soldOutBtn) {
        for (let i = 0; i < allArr.length; i++) {
          if (allArr[i].type == 'submit') {
            soldOutBtn = allArr[i];
            break;
          }
        }
      }
      if (!soldOutBtn) {
        for (let i = 0; i < allArr.length; i++) {
          if (allArr[i].disabled) {
            soldOutBtn = allArr[i];
            break;
          }
        }
      }
      if (!soldOutBtn) {
        soldOutBtn = allArr[0];
      }
      soldOutBtn && getBtnStyle(soldOutBtn);
    }
  }

  // 找shopify_payment_button以及parent
  function searchParentEl() {
    return new Promise(resolve => {
      // 首先获取所有的form，并进行遍历
      const forms = qa('form');
      for (let i = 0; i < forms.length; i++) {
        // 如果当前表单的action与预测的formAction相同，则推入trueForms数组
        if (forms[i].action.indexOf('/cart/add') !== -1){
          trueForms.push(forms[i]);
        }
      }
      if (!trueForms.length) {
        resolve({ code: 501, msg: 'Search el failed' });
      }
      // 如果只有一个form表单的action与预期的相同，则一定为要添加按钮的form
      if (trueForms.length == 1) {
        exactForm = trueForms[0];
        getSoldOutBtn(trueForms[0]);
      } else {
        // 对遍历得出的action符合预期的form数组再次进行循环
        for (let i = 0; i < trueForms.length; i++) {
          if (soldOutBtn) {
            break;
          }
          const formStyle = window.getComputedStyle(trueForms[i], null);
          // 如果form不显示的话，直接中断本次循环，继续遍历之后的form表单
          if (formStyle.visibility != 'visible' ||
              formStyle.display == 'none' ||
              formStyle.height == '0px' ||
              formStyle.height == '0' ||
              formStyle.width == '0px' ||
              formStyle.width == '0' ||
              formStyle.height == 'auto') {
            continue;
          }
          exactForm = trueForms[i];
          getSoldOutBtn(trueForms[i]);
          // 有可能在第一次内层btnArr循环的时候已经取得了shopify_payment_button，要考虑父级是否有正常显示。
          if (soldOutBtn) {
            const parent = soldOutBtn.parentElement;
            const parentStyle = window.getComputedStyle(parent, null);
            // 如果父级正常的话就结束trueForms循环
            if (parentStyle.visibility == 'visible' &&
                parentStyle.display != 'none' &&
                parentStyle.height != 0 &&
                parentStyle.width != 0) {
              break;
            }
          }
          // 在该form中寻找是否存在shopify payment button，有的话结束循环，没有的话开始遍历所有按钮寻找对的按钮
          soldOutBtn = trueForms[i].querySelector(payment_button_class);
          if (soldOutBtn) {
            break;
          } else {
            const iptSubArr = trueForms[i].querySelectorAll("input[type='submit']");
            // 如果存在input的类型为submit，则将该按钮数组里第一个直接赋给soldOutBtn，并结束循环
            if (iptSubArr.length != 0) {
              soldOutBtn = iptSubArr[0];
              break;
            }
            // 如果不存在input的类型为submit，则获取form下的所有按钮进行遍历
            const btnArr = trueForms[i].querySelectorAll('button');
            for (let j = 0; j < btnArr.length; j++) {
              if (btnArr[j].type == 'submit') {
                // 如果有类型为submit的按钮，直接将该按钮赋给soldOutBtn，并结束循环
                soldOutBtn = btnArr[j];
                // 注意，这里的break只是中断了当前的循环，外层循环还会继续。
                break;
              }
            }
          }
        }
        // 循环结束
      }
      if (soldOutBtn || exactForm) {
        const params = { code: 200, msg: 'success' };
        if (soldOutBtn) {
          insertType = 'afterend';
          insertEl = soldOutBtn;
        } else {
          insertType = 'beforeend';
          insertEl = exactForm;
        }
        resolve(params);
      } else if (times >= MAX_SEARCH_TIMES) {
        resolve({ code: 501, msg: 'Search el failed' });
      } else {
        times++;
        setTimeout(() => {
          searchParentEl().then(res => resolve(res));
        }, 50);
      }
    });
  }

  function getParentWithoutForm() {
    // 找所有的有可能是add-to-cart按钮的类名，用循环判断按钮位置
    const btnElements = qa('.action-button, [class*=add-to-cart], [class*=add_to_cart], [id*=add_to_card], [id*=add-to-card], [data-add-to-cart], .sold-out, #out-of-stock-gl');
    if (btnElements.length) {
      for (let i = 0; i < btnElements.length; i++) {
        // 有的时候增加/减少产品数量的按钮可能也会被选进来，用宽度排除
        const width = Number(window.getComputedStyle(btnElements[i], null).width.split('px')[0]);
        // 如果按钮有宽度，而且宽度>64，则大概率不是
        if (!isNaN(width) && width > 64) {
          return { type: 'afterend', ele: btnElements[i] };
        }
      }
    }
    const parents = qa('.action-button, .tt-swatches-container.tt-swatches-container-js');
    if (parents.length) {
      for (let i = 0; i < parents.length; i++) {
        const style = window.getComputedStyle(parents[i], null);
        if (style.visibility != 'visible' ||
            style.display == 'none' ||
            style.height == '0px' ||
            style.height == '0' ||
            style.width == '0px' ||
            style.width == '0' ||
            style.height == 'auto') {
          continue;
        }
        return { type: 'beforeend', ele: parents[i] };
      }
    }
    return { type: '' };
  }

  // 如果searchParentEl方法没有找到form
  function setInlineBtnWhenErr(el) {
    const res = getParentWithoutForm();
    res.type && res.ele.insertAdjacentHTML(res.type, el);
    getBISEle();
  }

  function handleSearchNodeFailed() {
    return new Promise(resolve => {
      getButtonStyle(shopId, buttonStyleUrl)
          .then(() => {
            if (!buttonData.btn_insert_el) {
              const newParentData = getParentWithoutForm();
              if (!newParentData.type) {
                resolve({ code: 404 });
              } else {
                resolve({ code: 200 });
              }
            } else {
              resolve({ code: 200 });
            }
          })
    })
  }

  function changeButtonPos() {
    /**
     * 用于更改按钮的位置/searchParentEl失败时指定parent
     */
    debug && console.log('changeButtonPos')
    const { btn_insert_customized, btn_insert_el, btn_insert_type } = buttonData;
    if (btn_insert_customized) {
      insertEl = q(btn_insert_el) || soldOutBtn;
      insertType = btn_insert_type || 'afterend';
    }
  }

  function handleBasicData() {
    debug && console.log('Handle Basic Data')
    if (soldOutBtn) {
      const parentStyle = window.getComputedStyle(soldOutBtn.parentElement, null);
      if (parentStyle.display == 'flex' &&
          parentStyle.flexDirection == 'row' &&
          parentStyle.flexWrap == 'nowrap') {
        soldOutBtn.parentElement.style.flexWrap = 'wrap';
      }
    }
    const v1 = variantData[0];
    try {
      productTitle = v1.name.split(' - ')[0].trim();
    } catch (error) {
      if (!v1.public_title) {
        productTitle = v1.name;
      } else {
        if ((v1.public_title.length - 3) > 0) {
          productTitle = v1.name.substr(0, v1.name.length - v1.public_title.length - 3);
        } else {
          productTitle = v1.name;
        }
      }
    }
  }
  function getAllStyle() {
    debug && console.log('Get All Style')
    const btnPromise = getButtonStyle(shopId, buttonStyleUrl);
    const popupPromise = getPopupStyle(shopId, popupStyleUrl);
    const intePromise = getIntegration(shopId, integrationUrl);
    Promise.all([btnPromise, popupPromise, intePromise]).then(() => {
      renderBtnAndPopup();
    });
  }

  // 请求后端按钮样式接口
  function getButtonStyle(shopId, btnurl) {
    if (btnStyleSwitch) {
      return new Promise(resolve => {
        resolve({ code: 200 })
      })
    }; // 请求过了就return
    debug && console.log('Get Button Style')
    // API路由
    const url = baseUrl + 'api/v1/' + btnurl;
    return request(url, { shopId,shop_language: window.Shopify.locale }).then(res => {
      debug && console.log('Get Button Style Success')
      const { code, data } = res;
      if (code === 200 && data) {
        btnStyleSwitch = 1;
        // inline设置
        Object.keys(buttonData).forEach(key => {
          buttonData[key] = data[key];
        });
        Object.keys(generalData).forEach(key => {
          generalData[key] = data[key];
        });
        renderSettingStyles();
        changeButtonPos();
      }
    });
  }
  // 请求后端弹窗样式接口
  function getPopupStyle(shopId, popupUrl) {
    debug && console.log('Get Popup Style')
    // API路由
    const url = baseUrl + 'api/v1/' + popupUrl;
    return request(url, { shopId,shop_language: window.Shopify.locale }).then(res => {
      debug && console.log('Get Popup Style Success')
      const { code, data } = res;
      if (code === 200 && data) {
        popupStyleSwitch = 1;
        popupData = JSON.parse(JSON.stringify(data));
        switch (popupData.popup_option) {
          case 1:
            selectedType.type = 'email';
            break;
          case 2:
            selectedType.type = 'sms';
            break;
          case 3:
            selectedType.type = 'email';
            break;
        }
      }
    });
  }
  // 请求后端集成情况接口
  function getIntegration(shopId, inteUrl) {
    debug && console.log('Get Integration')
    // API路由
    const url = baseUrl + 'api/v1/' + inteUrl;
    return request(url, { shopId }).then(res => {
      debug && console.log('Get Integration Success')
      const { code, data } = res;
      if (code === 200 && data) {
        debug && console.log('inte', data);
        // 只要有开启了的选项，就打开集成
        inteStatus = data.find(o => o.is_enable);
      }
    });
  }

  function renderSettingStyles() {
    debug && console.log('renderSettingStyles');
    const { btn_font_size,
      btn_hover_animation,
      btn_border_radius,
      btn_border_color,
      btn_font_weight,
      btn_font_family,
      btn_margin_top,
      btn_hover_font_color,
      btn_hover_color } = generalData;
    let generalStyles = `
      .email-me-button {
        font-size: ${btn_font_size}px !important;
        font-weight: ${btn_font_weight} !important;
        font-family: ${btn_font_family} !important;
        border-color: ${btn_border_color} !important;
        border-radius: ${btn_border_radius}px !important;
        border-width: 2px;
        border-style: solid;
      }
      .email-me-inlineButton {
        margin-top: ${btn_margin_top}px !important;
      }
      .email-me-button:hover {
        color: ${btn_hover_font_color} !important;            
        background-color: ${btn_hover_color} !important;        
      }
    `;
    if (btn_hover_animation) {
      generalStyles += `
      .email-me-inlineButton::after,
      .email-me-inlineButton::before,
      .email-me-submitButton::after,
      .email-me-submitButton::before {
          content:'';
          color: ${buttonData.btn_color};
          font-size: ${btn_font_size}px; 
          text-align: center; 
          border-radius: ${btn_border_radius}px;
          width: 0;
          height: 100%;
          background-color: ${btn_hover_color};
          position: absolute;
          left:0;
          transition: all ease-in-out .35s;
          top:0;
          z-index: -2;
      }
      .email-me-inlineButton::before,
      .email-me-submitButton::before {
          z-index: -1;
          background-color: ${btn_hover_color};
      }
      .email-me-inlineButton:hover,
        .email-me-submitButton:hover {
          z-index: 1;
          color: ${btn_hover_font_color} !important;
          background-color: ${btn_hover_color} !important;
      }
      .email-me-button:hover::before,
      .email-me-button:hover::after
      {
          width: 100%;
      }
      `;
    }
    const styles = `
    <style>
    ${generalStyles}
    </style>
    `;
    document.head.insertAdjacentHTML('beforeend', styles);
  }

  function renderBtnAndPopup() {
    debug && console.log('renderBtnAndPopup')
    // 预先创建没有库存的variantOptions
    const { toggler, ipt, mailingList } = renderSpecificPopup();
    const mountWindowElement = `       
      <div class="successSub">
        <div class="successSub_header">
            <img src="https://cdn.shopify.com/s/files/1/0576/6063/7389/t/1/assets/success.png?v=1629367773"/>
            <div class="successSub_header_text">${popupData.success_frame_title}</div>
            <div class="successSub_close-box">
                <div class="successSub_frame-close"></div>
            </div>
        </div>
        <div class="successSub_text">
            ${popupData.success_frame_content}
        </div>
      </div>
      <div id="email-me-frame">
        <div class="email-frame-content">
          <div class="close-box">
                <div class="frame-close"></div>
          </div>
          <div class="email-frame-header">
              <div class="frame-email-logo">
                  <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path d="M0 5.324V15.5A1.5 1.5 0 001.5 17h17a1.5 1.5 0 001.5-1.5V5.324l-9.496 5.54a1 1 0 01-1.008 0L0 5.324z"
                            fill="#5C5F62"/>
                      <path d="M19.443 3.334A1.494 1.494 0 0018.5 3h-17c-.357 0-.686.125-.943.334L10 8.842l9.443-5.508z"
                            fill="#5C5F62"/>
                  </svg>
              </div>
              <div class="frame-title">${popupData.popup_header_text}</div>
          </div>
          <div class="split-line" style="border: 1px solid #d9d9d9;"></div>
          <div class="email-frame-body">
            <div class="frame-body-content">
              <span>${productTitle}</span>
            </div>
            <div>
            <select class="selected-unavailable-variant"></select>
            </div>
            ${toggler || ''}
            <div>
              <input class="buyer-name" type="text" placeholder="${popupData.popup_name_placeholder_text}">
            </div>
            ${ipt}
            ${mailingList || ''}
            <div class="frame-submit">
              <div class="email-me-button email-me-submitButton" style=" text-align:center; color: ${popupData.popup_btn_font_color}; background-color:  ${popupData.popup_btn_color}; border-radius: ${btnRadius}; font-size: ${btnFontSize}; ">
                ${popupData.popup_btn_value}
              </div>
            </div>
          </div>
          <div class="email-frame-footer">
            <div class="email-footer-tips">
              <span>${popupData.popup_footer_text}</span>
            </div>
          </div>
          <div class="email-provider" style="display: ${buttonData.is_branding_removed ? 'none' : ''};">
              Powered by <span><a class="email-app-link" target="_blank" href="https://apps.shopify.com/email-1?surface_detail=back+in+stock&surface_inter_position=1&surface_intra_position=10&surface_type=search">Sealapps</a></span>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', mountWindowElement);

    renderButton().then(res => {
      debug && console.log('renderButton success')
      if (res.code === 200) {
        // 渲染按钮成功，进行下一步的操作
        changeButtonPos();
        createEmailButton(); // 查询店铺是否开启按钮
        listenVariantChange(); // 开始监听变体的变化
        getBISEle(); // 获取所有需要进行操作的DOM元素
        if (popupData.popup_option !== 1) {
          initSms(); // 初始化短信相关的操作
        }
      } else {
        debug && console.log('Insert failed');
      }
    });
  }

  function renderButton() {
    // 根据开启类型渲染按钮
    return new Promise(resolve => {
      const { inline_status, float_status } = buttonData;
      let flag = 0;
      if (inline_status) { // 如果开启了inline，挂载inline
        const { font_color, btn_color, btn_value, btn_margin_top } = buttonData;
        const mountInlineBtn = ` 
          <div id="product-restore-email" style="margin-top: ${btn_margin_top}px; max-width: ${inlineBtnWidth || 'initial'}">
            <div class="email-me-button email-me-inlineButton" style="text-align:center; margin-top:0; color: ${font_color} ; background-color: ${btn_color} ; height:${inlineBtnHeight} ; border-radius: ${btnRadius || '2px'} ; font-size: ${btnFontSize || '14px'} ; font-weight: ${btnFontWeight || 'inherit'};">
              ${btn_value}
            </div>
          </div>`;
        try {
          debug && console.log('insert', insertEl, insertType);
          insertEl.insertAdjacentHTML(insertType, mountInlineBtn);
          flag++;
        } catch (err) {
          setInlineBtnWhenErr(mountInlineBtn);
          flag++;
        }
      }

      if (float_status) {
        const { offset, float_font_color, float_btn_color, float_btn_value } = buttonData;
        const mountFloatBtn = ` 
          <div id="product-restore-email-float" style="top:${offset + 'px'}" class="${floatBtnPosition}">
              <div class="email-me-button email-me-floatButton" style="text-align:center; display:none; color: ${float_font_color} ; background-color:  ${float_btn_color} ; border-radius: ${btnRadius} ; font-size: ${btnFontSize}; font-weight: ${btnFontWeight}; ">
                  ${float_btn_value}
              </div>
          </div>`;
        document.body.insertAdjacentHTML('afterbegin', mountFloatBtn);
        flag++;
      }

      if (flag > 0) {
        resolve({ code: 200, msg: 'Success!' });
      } else {
        resolve({ code: 404, msg: 'Insert failed' });
      }
    });
  }

  function renderSpecificPopup(type) {
    /*
    * 根据用户开启的弹窗类型进行部分渲染
    * 1 - 只开了邮件，渲染邮件输入框
    * 2 - 只开了短信，渲染sms输入框
    * 3 - 都开了，渲染两种输入框以及toggler（开关）
    */
    let ipt, toggler, mailingList;
    type = popupData.popup_option || type;
    if (type === 1) {
      ipt = `
        <div>
          <input class="buyer-email" type="text" placeholder="${popupData.popup_placeholder_text}">
          <div class="invalid-email-tips">${popupData.popup_validation_text}</div>
        </div>
      `;
    } else if (type === 2) {
      ipt = `
        <div>
          <div class="buyer-phone-container">
            <input type="text" class="buyer-phone">
          </div>
          <div class="invalid-email-tips">${popupData.popup_validation_text}</div>
        </div>
      `;
    } else if (type === 3) {
      ipt = `
      <div>
        <input class="buyer-email" type="text" placeholder="${popupData.popup_placeholder_text}">
        <div class="buyer-phone-container">
          <input type="text" class="buyer-phone">
        </div>
        <div class="invalid-email-tips">${popupData.popup_validation_text}</div>
      </div>
      `;
      toggler = `
        <div class="notify-type-toggler">
          <div class="email-type">
              ${popupData.popup_tab_email}
          </div>
          <div class="sms-type">
              ${popupData.popup_tab_sms}
          </div>
        </div>
      `;
    }
    renderSpecificStyle(type);
    if (inteStatus) {
      mailingList = `
      <div class="join-mailing-container">
        <input id="join-mailing-list" type="checkbox" checked/>
        <label for="join-mailing-list" class="join-mailing-listLabel">
        ${popupData.popup_opt_in_text}
        </label>
      </div>
    `;
    }
    return {
      ipt,
      toggler,
      mailingList
    };
  }
  function renderSpecificStyle(type) {
    switch (type) {
      case 1:
      case 2:
        addStyle(
            `<style>
          #email-me-frame .email-frame-content {
            max-height: 412px !important;
          }
          </style>`
        );
        break;
      case 3:
        addStyle(
            `<style>
          #email-me-frame .email-frame-content {
            max-height: 459px !important;
          }
          </style>`
        );
        break;
      default:
        break;
    }
  }
  // 获取Back in stock相关的元素
  function getBISEle() {
    switch (popupData.popup_option) {
      case 1:
        emailInput = q('.buyer-email');
        break;
      case 2:
        smsInput = q('.buyer-phone');
        break;
      case 3:
        emailInput = q('.buyer-email');
        smsInput = q('.buyer-phone');
        break;
    }
    nameInput = q('.email-frame-body .buyer-name');
    successFrame = q('.successSub');
    invalidTip = q('.invalid-email-tips');
    emailFrameElement = q('#email-me-frame');
    closeBox = q('#email-me-frame .close-box');
    submitBtn = q('.frame-submit .email-me-button');
    variantSelector = q('.selected-unavailable-variant');

    inlineEmailDiv = q('#product-restore-email');
    floatEmailDiv = q('#product-restore-email-float');
    inlineBtnElement = q('.email-me-inlineButton');
    floatBtnElement = q('.email-me-floatButton');

    mailingCheckbox = q('#join-mailing-list') || {};
    // 获取完了各个元素之后开始进行事件的添加
    handleEleEvent();
  }

  function handleEleEvent() {
    // 对各个元素进行事件处理与绑定
    switch (popupData.popup_option) {
      case 1:
        emailInput.addEventListener('blur', verifyEmail);
        break;
      case 2:
        break;
      case 3:
        emailInput.addEventListener('blur', verifyEmail);
        break;
    }
    submitBtn.addEventListener('click', subEmail);
    // submitBtn.addEventListener('click', debounce(500, subEmail));
    closeBox.addEventListener('click', function() {
      emailFrameElement.style.display = 'none';
      if (variantSelector.style.display !== 'none') {
        currentVariantOption && currentVariantOption.removeAttribute('selected');
      }
    });
    successFrame.addEventListener('click', function() {
      successFrame.classList.remove('successSub_active');
    });
    mountedUnVariantOptions();
    initInlineAndFloatBtn();
  }

  function initInlineAndFloatBtn() {
    if (inlineBtnElement) {
      inlineBtnElement.addEventListener('click', function() {
        emailFrameElement.style.display = 'block';
        // 挂载没有库存的variant option
        const selected_unavailable_variant = emailFrameElement.querySelector('.selected-unavailable-variant');
        for (let i = 0; i < unVariantOptions.length; i++) {
          if (addOptionsStatus === 0) {
            selected_unavailable_variant.add(unVariantOptions[i]);
          }
          if (unVariantOptions[i].getAttribute('value') === selectVariantId.toString()) {
            currentVariantOption = selected_unavailable_variant.querySelectorAll('option')[i];
            currentVariantOption.setAttribute('selected', 'selected');
          }
        }
        addOptionsStatus = 1;
      });
    }

    if (floatBtnElement) {
      floatBtnElement.addEventListener('click', function() {
        emailFrameElement.style.display = 'block';
        // 挂载没有库存的variant option
        // const selected_unavailable_variant = emailFrameElement.querySelector('.selected-unavailable-variant');
        for (let i = 0; i < unVariantOptions.length; i++) {
          if (addOptionsStatus === 0) {
            variantSelector.add(unVariantOptions[i]);
          }
          if (unVariantOptions[i].getAttribute('value') === selectVariantId.toString()) {
            currentVariantOption = variantSelector.querySelectorAll('option')[i];
            currentVariantOption.setAttribute('selected', 'selected');
          }
        }
        addOptionsStatus = 1;
      });
    }
  }

  function mountedUnVariantOptions() {
    let optionIndex = 0;
    for (let i = 0; i < variantData.length; i++) {
      if (!variantData[i].available) {
        if (variantData[i]['title'] === 'Default Title') {
          variantSelector.style.display = 'none';
        }
        unVariantOptions[optionIndex] = create({
          tag: 'option',
          attributes: { 'value': variantData[i]['id'], 'textContent': variantData[i]['title'] }
        });
        optionIndex++;
      }
    }
  }

  function listenVariantChange() {
    /**
     * 该方法主要用于判断使用什么方法监听变体的变化
     * 1. 当url中包含variant=的时候，采用listen url的方法
     * 2. 当url中不包含的时候，采用定时器的方法
     */
    const url = document.URL;
    listenUrlStatus();
    if (url.indexOf('variant=') === -1) {
      checkVariantChange();
    }
  }

  function checkVariantChange() {
    debug && console.log('定时器开启，检查variant变化');
    const curVariantId = q('input[name=id], select[name=id]').value;
    handleVariantChange(curVariantId);
    listenVariantFlag && setTimeout(checkVariantChange, 100)
  }

  function listenUrlStatus() {
    overwritePushstate();
    window.addEventListener('locationchange', () => {
      const currentUrl = document.URL;
      // 如果之后开始要对collection页展示按钮了，可能会用到下面两行
      //   const url = new URL(currentUrl);
      //   const isVariantUrl = url.searchParams.get('variant');
      if (currentUrl !== initUrl) {
        const currentUrl = document.URL;
        const url = new URL(currentUrl);
        const vid = url.searchParams.get('variant');
        debug && console.log('vid', vid);
        initUrl = currentUrl;
        vid && handleVariantChange(vid);
        listenVariantFlag = false;
        debug && console.log('清除定时器');
      }
    });
  }

  function handleVariantChange(vid) {
    /**
     * TODO 当切换变体后url中开始有variant=了
     * 取消listen变体的定时器
     */
    if (!vid) return;
    if (String(selectVariantId) !== String(vid)) {
      selectVariantId = vid;
      currentVariant = variantData.find(o => o.id == vid);
      available = currentVariant.available;
      if (!available && !btnStyleSwitch || !popupStyleSwitch) {
        getAllStyle();
      }
      if (!available && !selBtnStatus) {
        createEmailButton();
      }
      if (selBtnStatus === 1) {
        debug && console.log('initEmailToMeEle');
        debug && console.log(currentVariant);
        initEmailToMeElement();
      }
    }
  }

  // 查询店铺订阅按钮的状态
  function createEmailButton() {
    debug && console.log('createEmailButton')
    if (selBtnStatus === 0) { // 还未成功请求服务器
      // url后缀
      const url = baseUrl + 'api/v1/email/selBtnStatus';
      request(url, { shopId }).then(res => {
        const { code, data } = res;
        if (code === 200) {
          if (data.status == 1 || data.status == 2 || data.status == 0 ||data.snsStatus) {
            selBtnStatus = 1;
            initEmailToMeElement();
          } else {
            selBtnStatus = data.status;
          }
        }
      });
    }
  }

  // 初始化按钮
  function initEmailToMeElement() {
    if (generalData.btn_display_all) {
      if (inlineBtnElement) {
        inlineBtnElement.style.display = 'flex';
        inlineEmailDiv.style.display = 'flex';
      }
      if (floatBtnElement) {
        floatBtnElement.style.display = 'flex';
        floatEmailDiv.style.display = 'flex';
      }
      return;
    }
    if (selBtnStatus === 1 && !available) {
      if (inlineBtnElement) {
        inlineBtnElement.style.display = 'flex';
        inlineEmailDiv.style.display = 'flex';
      }
      if (floatBtnElement) {
        floatBtnElement.style.display = 'flex';
        floatEmailDiv.style.display = 'flex';
      }
    } else {
      if (inlineBtnElement) {
        // inlineBtnElement.style.display = "none";
        inlineEmailDiv.style.display = 'none';
      }
      if (floatBtnElement) {
        // floatBtnElement.style.display = 'none';
        floatEmailDiv.style.display = 'none';
      }
    }
  }

  // 校验邮件格式
  function verifyEmail() {
    const email = emailInput.value;
    const reg = new RegExp(
        /^[a-zA-Z0-9_.-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z0-9]{2,6}$/
    );
    if (!reg.test(email)) {
      toggleInvalidTip(true, { type: 'email', info: popupData.popup_validation_text });
    } else {
      invalidTip.style.visibility = 'hidden';
    }
  }
  // 创建element
  function create({
                    tag,
                    appendTo,
                    children = [],
                    attributes = {},
                    events = {}
                  }) {
    const element = document.createElement(tag);
    Object.entries(attributes).forEach(([key, value]) => {
      element[key] = value;
    });

    Object.entries(events).forEach(([key, value]) => {
      element.addEventListener(key, value);
    });

    if (appendTo) {
      appendTo.appendChild(element);
    }

    children.forEach((child) => element.appendChild(child));
    return element;
  }

  // 提交订阅 selectVariantId
  function subEmail() {
    const { popup_validation_text } = popupData;
    let buyerName;
    if (nameInput) {
      buyerName = nameInput.value;
    }
    switch (selectedType.type) {
      case 'sms':
        const sms = smsInput && smsInput.value || '';
        if (!sms) {
          toggleInvalidTip(true, { type: 'sms', info: popup_validation_text });
        } else {
          if (iti.isValidNumber()) {
            toggleInvalidTip(false);
            subscribeSms({ buyerName });
          } else {
            toggleInvalidTip(true, { type: 'sms', info: popup_validation_text });
          }
        }
        break;
      case 'email':
        const email = emailInput.value;
        if (!email) {
          toggleInvalidTip(true, { type: 'email', info: popup_validation_text });
        } else {
          // 判断邮件的格式是否正确
          const reg = new RegExp(
              /^[a-zA-Z0-9_.-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z0-9]{2,6}$/
          );
          if (reg.test(email)) {
            toggleInvalidTip(false);
            subscribeEmail({ buyerName });
          } else {
            toggleInvalidTip(true, { type: 'email', info: popup_validation_text });
          }
        }
        break;
      default:
        return;
    }
  }

  function toggleInvalidTip(show, data) {
    /**
     * 函数的本意是为了开关invalid提示，但是如果设置了show的话就是为了手动隐藏/关闭
     * show - 展示/隐藏提示
     * data.type - 当前提示的类型
     * data.info - 当前提示的信息
     */
    const style = getComputedStyle(invalidTip);
    const { type, info } = data ||
    { type: selectedType.type, info: popupData.popup_validation_text };
    switch (type) {
      case 'sms':
        if (style.visibility === 'hidden') {
          invalidTip.style.visibility = 'visible';
          invalidTip.innerHTML = info;
        } else {
          invalidTip.style.visibility = 'hidden';
        }
        break;
      case 'email':
        if (style.visibility === 'hidden') {
          invalidTip.style.visibility = 'visible';
          invalidTip.innerHTML = info;
        } else {
          invalidTip.style.visibility = 'hidden';
        }
        break;
      default:
        invalidTip.style.visibility = 'hidden';
        break;
    }
    debug && console.log(invalidTip);
    if (show) {
      invalidTip.style.visibility = 'visible';
    } else if (show === false) {
      invalidTip.style.visibility = 'hidden';
    }
  }

  function subscribeSms(data) {
    // 传递的参数
    const params = {
      shopId: shopId,
      variant_rid: variantSelector.value,
      receiver_number: formatPhoneNumber(smsInput.value.trim()),
      region: iti.getSelectedCountryData().iso2.toUpperCase(),
      is_integration: Number(mailingCheckbox.checked || false),
      receiver_name: data.buyerName || 'customer',
      customer_rid: 0,
      shop_language: window.Shopify.locale
    };
    const url = baseUrl + 'api/v1/sns/insCustomerSnsInfo';
    submitBtn.parentElement.className = 'frame-submit loading';
    request(url, params).then(res => {
      const { code } = res;
      if (code === 200) {
        emailFrameElement.style.display = 'none';
        successFrame.classList.add('successSub_active');
        setTimeout(function() {
          successFrame.classList.remove('successSub_active');
        }, 4000);
      } else if (code === 108 || code === 107) {
        // 新增订阅失败
        invalidTip.style.visibility = 'visible';
        invalidTip.innerHTML = popupData.popup_subscribed_text;
      } else if (code === 109) {
        invalidTip.style.visibility = 'visible';
        invalidTip.innerHTML = popupData.popup_validation_text;
      } else {
        invalidTip.style.visibility = 'visible';
        invalidTip.innerHTML = 'Oops, submission failed. Please try again later.';
      }
    }).finally(() => {
      submitBtn.parentElement.className = 'frame-submit';
    });
  }

  function subscribeEmail(data) {
    // url后缀
    // 传递的参数
    const params = {
      shopId: shopId,
      variant_rid: variantSelector.value,
      receiver_email: document.getElementsByClassName('buyer-email')[0].value,
      receiver_name: data.buyerName || 'customer',
      is_integration: Number(mailingCheckbox.checked || false),
      customer_rid: 0,
      shop_language: window.Shopify.locale
    };
    const url = baseUrl + 'api/v1/email/insCustomerEmailInfo';
    submitBtn.parentElement.className = 'frame-submit loading';
    request(url, params).then(res => {
      const { code } = res;
      if (code === 200) {
        emailFrameElement.style.display = 'none';
        successFrame.classList.add('successSub_active');
        setTimeout(function() {
          successFrame.classList.remove('successSub_active');
        }, 4000);
      } else if (code === 108 || code === 107) {
        // 新增订阅失败
        invalidTip.style.visibility = 'visible';
        invalidTip.innerHTML = '* You are already subscribed to this product.';
      } else if (code === 109) {
        invalidTip.style.visibility = 'visible';
        invalidTip.innerHTML = popupData.popup_validation_text;
      } else {
        invalidTip.style.visibility = 'visible';
        invalidTip.innerHTML = 'Oops, submission failed. Please try again later.';
      }
    }).finally(() => {
      submitBtn.parentElement.className = 'frame-submit';
    });
  }

  function formatPhoneNumber(num) {
    const code = iti.getSelectedCountryData().dialCode;
    if (!num.startsWith(code)) {
      // 如果电话不是以区号开头的，直接拼接区号并返回
      return (code + num);
    } else {
      return num;
    }
  }

  function initSms() {
    const emailInput = q('.buyer-email');
    // const phoneInput = q('.buyer-phone-block');
    const phoneInput = q('.buyer-phone');
    const phoneContainer = q('.buyer-phone-container');
    // const countrySelector = q('.country-selector');
    // const countryList = q('.country-selector-list');
    const emailTypeBtn = q('.email-type');
    const smsTypeBtn = q('.sms-type');
    initPhoneInput().then(res => {
      if (res.code === 200 && popupData.popup_option === 3) {
        selectedType = new Proxy({ type: 'email' }, {
          set(target, key, newVal) {
            debug && console.log(target, key, newVal);
            target[key] = newVal;
            toggleInput(newVal);
            return true;
          }
        });
        toggleInput(selectedType.type);
        emailTypeBtn.addEventListener('click', () => {
          selectedType.type = 'email';
        });
        smsTypeBtn.addEventListener('click', () => {
          selectedType.type = 'sms';
        });
      }
    });

    function initPhoneInput() {
      /*
        * 在这里引入了插件intl-tel-input
        * 具体的使用方法可以在这两个地方看
        * npm: https://www.npmjs.com/package/intl-tel-inpu
        * github: https://github.com/jackocnr/intl-tel-input#getting-started-not-using-a-bundler
        * 在这里有对应的全套cdn https://cdnjs.com/libraries/intl-tel-input
        */
      return new Promise((resolve) => {
        const cssUrl = 'https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.16/css/intlTelInput.css';
        addScript(cssUrl).then(cssRes => {
          if (cssRes.code === 200) {
            // 国旗是png格式的精灵图，也是由cdn引入的，具体看下面resetFlag中的参数
            const resetFlag = `
              <style>
              .iti__flag {background-image: url("https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.16/img/flags.png");}
              @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
              .iti__flag {background-image: url("https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.16/img/flags@2x.png");}
              }
              .iti.iti--allow-dropdown {
                  width: 100%;
                  display: flex;
                  height: var(--sa-button-height-normal);
                  margin-top: 10px;
              }
              .iti__country {
                color: #777777;
              }
              </style>
            `;
            document.head.insertAdjacentHTML('beforeend', resetFlag);

            // 确保插件的css引入了之后再进行js的引入
            addScript('https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.16/js/intlTelInput.min.js', true).then(script => {
              // 获得创建的script元素，再将script元素引入之前先对其进行
              script.onload = function() {
                iti = window.intlTelInput(phoneInput, {
                  utilsScript: 'https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.16/js/utils.min.js',
                  autoPlaceholder: 'aggressive'
                });
                debug && console.log('Script Loaded');
                debug && console.log(phoneInput);
                phoneInput.addEventListener('input', e => {
                  debug && console.log('getNumber', iti.getNumber());
                  debug && console.log('getSelectedCountryData', iti.getSelectedCountryData());
                  iti.isValidNumber() ? toggleInvalidTip(false) : toggleInvalidTip(true);
                });
                phoneInput.addEventListener('blur', e => {
                  debug && console.log('wuhu');
                  debug && console.log('isValidNumber', iti.isValidNumber());
                  iti.isValidNumber() ? toggleInvalidTip(false) : toggleInvalidTip(true);
                });
              };
              document.body.appendChild(script);
              resolve({ code: 200 });
            });
          }
        });
      });
    }

    function toggleInput(type) {
      // 切换Email / SMS选项时进行操作
      invalidTip.style.visibility = 'hidden';
      switch (type) {
        case 'sms':
          emailInput.style.display = 'none';
          phoneContainer.style.display = 'flex';
          emailTypeBtn.className = 'email-type';
          smsTypeBtn.className = 'sms-type type-selected';
          // mailingCheckbox.parentElement.style.display = 'none';
          break;
        case 'email':
          smsTypeBtn.className = 'sms-type';
          emailInput.style.display = 'block';
          phoneContainer.style.display = 'none';
          emailTypeBtn.className = 'email-type type-selected';
          // mailingCheckbox.parentElement.style.display = 'flex';
          break;
        default:
          invalidTip.style.visibility = 'hidden';
          break;
      }
    }
  }
  // 封装引入js, css的函数
  function addScript(url, returnWithScript = false) {
    return new Promise((resolve, reject) => {
      try {
        const type = url.endsWith('.js') && 'js' || 'css';
        if (type === 'js') {
          const script = document.createElement('script');
          script.setAttribute('type', 'text/javascript');
          script.setAttribute('src', url);
          if (returnWithScript) {
            resolve(script);
          }
          document.head.appendChild(script);
          resolve({ code: 200, data: script, type: 'script' });
        } else if (type === 'css') {
          const link = document.createElement('link');
          link.setAttribute('rel', 'stylesheet');
          link.setAttribute('href', url);
          if (returnWithScript) {
            resolve(link);
          }
          document.head.appendChild(link);
          resolve({ code: 200, data: link, type: 'style' });
        }
      } catch (err) {
        reject({ code: 600, err });
      }
    });
  }

  function request(url, params, callback, method = 'POST') {
    /**
     * 封装请求函数
     * @param(url) - api请求地址，必选。
     * @param(params) - 请求参数，可选。
     * @param(callback) - 回调函数，可选。没有回调函数也会resolve获得到的数据
     * @param(method) - 请求方法，可选。
     * @returns Promise
     */
    return new Promise((resolve, reject) => {
      if (!url) {
        resolve({ code: 999, data: '没有传api地址' });
      }
      try {
        // 有params就拆params，不然就给个空对象方便请求
        const finalParams = params || {};
        if (params && !Object.keys(params).includes('shopId') || !params) {
          finalParams.shopId = shopId; // 参数中没给shopId就给一下
        }
        const xmlHttp = new XMLHttpRequest();
        // post请求方式
        xmlHttp.open(method, url, true);
        // 添加http头，发送信息至服务器时的内容编码类型
        xmlHttp.setRequestHeader('Content-Type', 'application/json');
        xmlHttp.setRequestHeader('authorization', domain);
        // 发送数据，请求体数据
        xmlHttp.send(JSON.stringify(finalParams));
        // 发送数据
        xmlHttp.onreadystatechange = function() {
          // 请求完成
          if (xmlHttp.readyState == 4 && xmlHttp.status == 200 || xmlHttp.status == 304) {
            // 从服务器上获取数据
            const json = JSON.parse(this.responseText);
            const { code, data } = json;
            if (code === 200) {
              if (callback) {
                callback(data);
              }
              resolve(json);
            } else if (code !== 500) {
              resolve(json);
            }
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  function getUserConfig(){
    const params = {
      type:'user_config'
    }
    const url = baseUrl + 'api/v1/collect/config';
    request(url, params);
  }

  // inject css 样式
  function importStyles() {
    const styles = `<style>
    body {
      --sa-border-normal: 1px solid #d9d9d9;
      --sa-border-hover: 2px solid skyblue;
      --sa-button-height-normal: 44px;
      --sa-border-radius-input: 4px;
      --sa-border-radius-button: 4px;
      --sa-border-color: #d9d9d9;
      --sa-disabled-bgc: #f2f2f2;
      --sa-btn-hover-bgc: #f6f6f7;
      --sa-input-padding: 8px;
    }
    #email-me-frame * {
        box-sizing: border-box;
    }
    #email-me-frame *:empty {
      display: inherit;
    }
  .email-me-button{
    width: 100%;
    height: var(--sa-button-height-normal);
    /*background-color: rgb(51, 51, 51);*/
    /*border-radius: 7px;*/
    /*color: white;*/
    border-width: 0px;
    font-size: 15px;
    cursor: pointer;
    letter-spacing: 1px;
    border-radius: var(--sa-border-radius-button);
    align-items:center;
    display: flex;
    justify-content: center;
    box-sizing: border-box;
    transition: all linear .15s;
    position: relative;
  }
  .email-me-inlineButton {
    display: none;
  }
  #email-me-frame {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.2);
    z-index: 9999999;
    display: none;
  }

  #email-me-frame input {
    background-color: #ffffff;
    border: 1px solid var(--sa-border-color);
    border-radius: var(--sa-border-radius-input);
  }
  
  #email-me-frame .email-frame-content{
    width: 65%;
    /*height: 358px;*/
    max-width: 398px;
    min-width: 300px;
    background: white;
    border-radius: 7px;
    padding-bottom:16px;
    border: 1px solid var(--sa-border-color);
    box-shadow: 0 0 18px #00000030;
    animation: fadeIn .15s linear;
    position: fixed;
    top: 50%; left: 50%;
    bottom: 0;
    height: 100%;
    max-height: 508px;
    transform: translate(-50%, -50%);
    overflow-y: scroll;
  }
  .email-frame-content::-webkit-scrollbar {
    /*滚动条整体样式*/
    width: 4px; /*高宽分别对应横竖滚动条的尺寸*/
    height: 1px;
  }
  .email-frame-content::-webkit-scrollbar-thumb {
    /*滚动条里面小方块*/
    border-radius: 10px;
    background: #a9a9a9;
  }
  .email-frame-content::-webkit-scrollbar-track {
    /*滚动条里面轨道*/
    box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.2);
    background: #ededed;
    border-radius: 10px;
  }
  
  #email-me-frame .frame-close {
      margin-top: 10px;
      margin-bottom: 10px;
      margin-right: 5px;
      cursor: pointer;
      display: inline-block;
      width: 100%;
      height: 2px;
      background: #333;
      transform: rotate(
              45deg
      );
  }
  #email-me-frame .frame-close::after{
      content: "";
      display: block;
      height: 2px;
      background: #333;
      transform: rotate(
              -90deg
      );
  }
  
  #email-me-frame .email-frame-header{
      display: flex;
      justify-content: center;
      clear: both;
      padding-top: 2px;
      padding-left: 30px;
      margin-bottom: 7px;
      font-family: "Arial",sans-serif;
  
  }
  
  #email-me-frame .close-box{
      width: 20px;
      height: 19px;
      float: right;
      margin-right: 5px;
      margin-top: 5px;
      cursor: pointer;
  }
  
  #email-me-frame .frame-email-logo svg{
      background-size: 25px 25px;
      width: 24px;
      margin-top: 3px;
  }
  
  #email-me-frame .frame-title{
      padding-left: 13px;
      flex: 1;
      color:#1A1B18;
      font-size: 16px;
      font-weight: 600;
      padding-top: 3px;
  }
  
  #email-me-frame .split-line {
      border: 1px solid var(--sa-border-color);
  }
  
  #email-me-frame .email-frame-body{
      padding-left: 30px;
      padding-right: 30px;
  }
  
  #email-me-frame .frame-body-content{
      letter-spacing: 0.01rem;
      line-height: 1.6rem;
      font-weight: 500;
      font-size: 15px;
      margin-top:16px;
      margin-bottom: 5px;
      color:#1A1B18;
  }
  
  #email-me-frame .buyer-email,
  #email-me-frame .buyer-phone-input,
  #email-me-frame .buyer-name{
      border-radius: var(--sa-border-radius-input);
      border: 1px solid var(--sa-border-color);
      margin: 10px 0 0 0;
      width: 100%;
      font-size: 15px ;
      outline: none !important;
      height: var(--sa-button-height-normal) !important;
      color: #000 !important;
      background: #fff !important;
      padding: var(--sa-input-padding) !important;
  }
  .buyer-phone-input {
      border-left: none;
  }

  #email-me-frame .notify-type-toggler {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      font-size: 15px ;
      height: var(--sa-button-height-normal) !important;
      color: #000 !important;
      background: #fff !important;
      margin-top: 10px;
  }
  .notify-type-toggler > div {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      border: 1px solid var(--sa-border-color);
      height: 100%;
      cursor: pointer;
      transition: all linear .14s;
  }
  .notify-type-toggler > div:hover {
      background: var(--sa-btn-hover-bgc)
  }
  .notify-type-toggler > div:nth-child(1) {
      border-radius: var(--sa-border-radius-button) 0 0 5px;
  }
  .notify-type-toggler > div:nth-child(2) {
      border-left: 0;
      border-radius: 0 5px 5px 0;
  }
  .join-mailing-container {
    display: flex;
    align-items: center;
    font-size: 12px;
    line-height: 12px;
    margin-top: 4px;
  }
  .join-mailing-listLabel {
    margin: 0 0 0 8px;
    color: #333333 !important;
  }
  #email-me-frame .buyer-phone-block {
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      height: var(--sa-button-height-normal);
      padding: var(--sa-input-padding);
  }
  #email-me-frame .country-selector {
      width: 54px;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      border: 1px solid var(--sa-border-color);
      cursor: pointer;
  }
  #email-me-frame .country-selector:hover {
      background: var(--sa-disabled-bgc);
  }
  #email-me-frame .country-selector-list {
      max-width: 120px;
      position: absolute;
      border: 1px solid var(--sa-border-color);
      border-radius: 8px;
      background-color: #fff;
      list-style: none;
      padding: 0px;
      max-height: 120px;
      overflow-y: scroll;
      margin-bottom: 50%;
  }
  #email-me-frame .country-selector-list li {
      display: flex;
      flex-wrap: nowrap;
      justify-content: space-between;
      align-items: center;
      padding: var(--sa-input-padding);
      cursor: pointer;
      transition: all linear .14s;
      bottom: 0;
  }
  #email-me-frame .country-selector-list li:hover {
      background-color: #eeeeee;
  }
  .buyer-phone {
      outline: none;
      flex: 1;
      transition: all linear .14s;
      border: var(--sa-border-normal);
      border-radius: var(--sa-border-radius-button);
  }
  input::-webkit-input-placeholder{
      color:gray;
      font-size:15px;
  }
  
  input::-moz-placeholder{   /* Mozilla Firefox 19+ */
      color:gray;
      font-size:15px;
  }
  input:-moz-placeholder{    /* Mozilla Firefox 4 to 18 */
      color:gray;
      font-size:15px;
  }
  input:-ms-input-placeholder{  /* Internet Explorer 10-11 */
      color:gray;
      font-size:15px;
  }
  
  
  #email-me-frame .frame-submit{
      position: relative;
  }

  /* loading的代码 */
  .frame-submit.loading {
    pointer-events: none;
    cursor: not-allowed;
  }
  .frame-submit.loading::after {
    content: '';
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border-bottom: 2px solid #ddd;
    border-right: 2px solid #ddd;
    animation: spin ease-in-out 0.8s infinite;
    position: absolute;
    top: 11px;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  .frame-submit.loading .email-me-submitButton {
    opacity: 0;
  }
  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
  
  #email-me-frame .selected-unavailable-variant{
      border-radius: var(--sa-border-radius-button);
      border: 1px solid var(--sa-border-color);
      margin: 10px 0 0 0;
      width: 100%;
      height: var(--sa-button-height-normal);
      font-size: 15px;
      outline: none;
      color: #000;
      padding: var(--sa-input-padding) !important;
      background: #fff;
  }
  
  #email-me-frame .invalid-email-tips{
      color: rgb(219, 17, 42);
      font-weight: 500;
      letter-spacing: 0;
      visibility: hidden;
      line-height: 24px;
      font-size: 12px;
  }
  
  #email-me-frame .email-frame-footer{
      padding: 0 30px;
      margin-top: 20px;
  }
  
  #email-me-frame .email-frame-footer .email-footer-tips{
      font-size: 14px;
      font-family: "Arial",sans-serif;
      line-height: 1.1em;
      color: #ccc;
  }
  #email-me-frame .email-app-link{
      color: #008ddd;
  }
  #email-me-frame .email-app-link:hover{
      color: #0089d6;
  }
  #email-me-frame .email-app-link:visited{
      color: #008ddd;
  }
  #email-me-frame .email-app-link:active{
      color: #008ddd;
  }
  #email-me-frame .email-provider {
      margin-top: 8px;
      text-align: center !important;
      font-family: "Arial",sans-serif;
      color: black;
      font-size: 12px;
  }
  .successSub_header img {
    width: 32px;
    margin: 0;
}
  .successSub {
    transition: width 0.5s ease-out, opacity 0.5s ease-in, visibility 0.5s ease-in;
    max-width: 350px;
    background: rgb(255, 255, 255);
    padding: 20px;
    border-radius: 7px;
    border:1px solid #445958 ;
    display: block;
    z-index: -1;
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    visibility: hidden;
    opacity: 0;
    color: #464646;
}
.successSub_active {
    width: 100%;
    visibility: visible;
    opacity: 1;
    z-index: 999999999;
}
#product-restore-email img {
    width: 44px;
    margin: 0;
}
#email-me-frame img {
    /* width: 100%; */
    width: 50px;
    margin-right: 8px;
}
.successSub_header {
    width: 100%;
    align-items: center;
    justify-content: space-between;
    display: flex;
}
.successSub_header_text {
    font-weight: 700;
    flex: 1;
    padding-left: 8px;
}
.successSub_close-box {
    width: 20px;
    height: 20px;
    padding: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    transform: translate(8px, -16px);
}
.successSub_frame-close {
    margin-bottom: 10px;
    cursor: pointer;
    display: inline-block !important;
    width: 100%;
    height: 1px;
    background: #333;
    transform: rotate( 
        45deg
    );
}
.successSub_frame-close::after {
    content: '';
    display: block;
    height: 1px;
    background: #333;
    transform: rotate( 
        -90deg
    );
}
.successSub_text {
    margin-top: 8px;
    font-size: 20px;
    font-weight: 500;
    line-height: 1.5;
}
  #product-restore-email{
      justify-content: flex-start;
      width: 100%;
      flex:1;
  }
  #product-restore-email input {
    background: #ffffff;
  }
  #product-restore-email-float{
      display: flex;
      z-index:99999999999;
      justify-content: center;
      position:fixed;

  }
  .float-btn-left{
      transform: rotate(90deg) translateY(-100%);
      transform-origin: 0% 0%;
      left:0;
  }
  .float-btn-right{
      transform: rotate(-90deg) translateY(-100%);
      transform-origin: 100% 0%;
      right:0;
  }
  #product-restore-email-float .email-me-button{
      padding: 0.8rem 1.2rem;
  }
  #email-me-frame .email-provider span{
      color: blue;
  }
  @keyframes fadeIn {
      0% {
          opacity: .6;
      }
      100% {
          opacity: 1;
      }
  }
  /* 滚动条设置没有生效 */
  /* 滚动条整体部分，可以设置宽度啥的 */
  #email-me-frame .country-selector-list ::-webkit-scrollbar {
    width: 2px;
    height: 2px;
  }
  /* 滚动条两端的按钮 */
  #email-me-frame .country-selector-list ::-webkit-scrollbar-button {
    display: none !important;
  }
  /* 外层轨道 */
  #email-me-frame .country-selector-list ::-webkit-scrollbar-track  {
    display: none !important;
  }
  /* 内层滚动槽 */
  #email-me-frame .country-selector-list ::-webkit-scrollbar-track-piece{
    display: none !important;
  }
  /* 滚动的滑块  */
  #email-me-frame .country-selector-list ::-webkit-scrollbar-thumb {
    background-color:#ff9900;
    background-color:rgba(255,153,0, 0.6);
    border-radius: 10px;
  }
  .type-selected {
    pointer-events: none;
    background-color: var(--sa-disabled-bgc);
  }
  
              </style>`;
    document.head.insertAdjacentHTML('beforeend', styles);
  }
  function addStyle(style) {
    if (typeof style === 'string') {
      document.head.insertAdjacentHTML('beforeend', style);
    } else {
      document.head.appendChild(style);
    }
  }
  // 获取url参数
  function getQueryString(name) {
    const reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)', 'i');
    const r = window.location.search.substr(1).match(reg);
    if (r != null) {
      return unescape(r[2]);
    }
    return null;
  }

  function changeStatus(data) {
    const emailCustomerId = getQueryString('emailCustomerId');
    if (!emailCustomerId) {
      return;
    }
    const variantId = getQueryString('variant');
    if (!variantId) {
      return;
    }
    const { baseUrl, shopId } = data;
    // 传递的参数
    const params = {
      id: emailCustomerId,
      shopId,
      variantId
    };
    // API路由
    const url = baseUrl + 'api/v1/email/changeEmailStatus';
    request(url, params);
  }

  function overwritePushstate() {
    const oldPushState = history.pushState;
    history.pushState = function pushState() {
      const ret = oldPushState.apply(this, arguments);
      window.dispatchEvent(new Event('pushstate'));
      window.dispatchEvent(new Event('locationchange'));
      return ret;
    };

    const oldReplaceState = history.replaceState;
    history.replaceState = function replaceState() {
      const ret = oldReplaceState.apply(this, arguments);
      window.dispatchEvent(new Event('replacestate'));
      window.dispatchEvent(new Event('locationchange'));
      return ret;
    };

    window.addEventListener('popstate', () => {
      window.dispatchEvent(new Event('locationchange'));
    });
  }

  function q(c) {
    return document.querySelector(c);
  }

  function qa(c) {
    return document.querySelectorAll(c);
  }
})();