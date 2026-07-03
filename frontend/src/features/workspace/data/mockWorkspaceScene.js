import { PROCESSING_STATUS_QUEUED } from "../constants";
import { getBinaryProcessingStatus, getSequentialProcessingStatus } from "../utils/processingStatus";

function createDebateRoles() {
  return [
    {
      id: "defender",
      name: "Защищающий",
      status: "размышляет",
      variant: "defender",
      placement: "top-left",
    },
    {
      id: "attacker",
      name: "Атакующий",
      status: "размышляет",
      variant: "attacker",
      placement: "top-right",
    },
    {
      id: "manufacturer",
      name: "Производственник",
      status: "слушает",
      variant: "manufacturer",
      placement: "bottom-center",
    },
  ];
}

function createEvaluationAgents() {
  return [
    {
      id: "ecology",
      name: "Экология",
      status: "оценивает",
      variant: "ecology",
      placement: "left",
    },
    {
      id: "scaling",
      name: "Масштабирование",
      status: "оценивает",
      variant: "scaling",
      placement: "left-center",
    },
    {
      id: "safety",
      name: "Безопасность",
      status: "оценивает",
      variant: "safety",
      placement: "right-center",
    },
    {
      id: "patent",
      name: "Патентная чистота",
      status: "оценивает",
      variant: "patent",
      placement: "right",
    },
  ];
}

const attachmentKindSizeWeight = {
  txt: 120,
  csv: 260,
  doc: 420,
  docx: 440,
  pdf: 680,
  xls: 760,
  xlsx: 780,
  image: 940,
  jpg: 940,
  jpeg: 940,
  png: 980,
  zip: 1300,
};

function estimateAttachmentSizeKb(attachment, index) {
  const kindWeight = attachmentKindSizeWeight[attachment.kind] ?? 520;
  return attachment.sizeKb ?? kindWeight + ((index + 1) * 37);
}

function createAttachmentProcessingState(attachments) {
  const orderedAttachmentIds = [...attachments]
    .map((attachment, index) => ({
      id: attachment.id,
      sizeKb: estimateAttachmentSizeKb(attachment, index),
    }))
    .sort((firstAttachment, secondAttachment) => firstAttachment.sizeKb - secondAttachment.sizeKb)
    .map((attachment) => attachment.id);
  const processingStatusById = new Map(
    orderedAttachmentIds.map((attachmentId, index) => [
      attachmentId,
      getBinaryProcessingStatus(index, orderedAttachmentIds.length),
    ]),
  );

  return attachments.map((attachment, index) => ({
    ...attachment,
    sizeKb: estimateAttachmentSizeKb(attachment, index),
    processingStatus: processingStatusById.get(attachment.id) ?? PROCESSING_STATUS_QUEUED,
  }));
}

function createAttachmentSeries({ idPrefix, count, kind, fileNamePrefix, summary }) {
  return Array.from({ length: count }, (_, index) => {
    const attachmentNumber = String(index + 1).padStart(2, "0");

    return {
      id: `${idPrefix}-${attachmentNumber}`,
      kind,
      fileName: `${fileNamePrefix}-${attachmentNumber}.${kind}`,
      summary,
    };
  });
}

function createHypotheses({ idPrefix, count, topic }) {
  const descriptions = [
    `Проверить узкое технологическое окно для ${topic}, где выигрыш достигается без роста сложности процесса.`,
    `Сравнить базовый маршрут с более дешёвой заменой критического этапа и оценить потерю качества.`,
    `Выделить фактор, который одновременно влияет на KPI и производственные ограничения в пилотной серии.`,
    `Проверить короткий сценарий масштабирования до инвестиций в полноценную опытную установку.`,
    `Отдельно протестировать слабое место, которое может обнулить эффект при переносе в реальные условия.`,
  ];

  return descriptions.slice(0, count).map((description, index) => ({
    id: `${idPrefix}-hypothesis-${index + 1}`,
    title: `Гипотеза ${index + 1}`,
    description,
    processingStatus: getSequentialProcessingStatus(index, count),
  }));
}

const requestContexts = [
  { value: "kpi", label: "KPI" },
  { value: "constraints", label: "Ограничения" },
  { value: "context", label: "Контекст" },
];

function createLaunchedRequests({ idPrefix, count, topic }) {
  const requestTexts = [
    `Измеримый эффект для ${topic} должен быть подтверждён короткой серией испытаний.`,
    "Не выходить за доступное производственное окно и текущие ограничения оборудования.",
    "Учитывать только источники, где явно описаны успешные и провальные подходы.",
    "Сравнить варианты по стоимости пилота, риску масштабирования и времени проверки.",
    "Отдельно отметить зависимости от поставщиков и редких компонентов.",
    "Проверить, можно ли валидировать гипотезу без полной перестройки процесса.",
  ];

  return Array.from({ length: count }, (_, index) => ({
    id: `${idPrefix}-request-${index + 1}`,
    context: requestContexts[index % requestContexts.length],
    text: requestTexts[index % requestTexts.length],
  }));
}

function createSession({
  id,
  title,
  query,
  answer,
  attachments,
  hypothesisCount = 3,
  requestCount = 3,
}) {
  return {
    id,
    title,
    query,
    answer,
    hypotheses: createHypotheses({
      idPrefix: id,
      count: hypothesisCount,
      topic: title.toLocaleLowerCase(),
    }),
    launchedRequests: createLaunchedRequests({
      idPrefix: id,
      count: requestCount,
      topic: title.toLocaleLowerCase(),
    }),
    attachments: createAttachmentProcessingState(attachments),
    debate: {
      playLabel: "Открыть сцену",
      roles: createDebateRoles(),
    },
    evaluation: {
      agents: createEvaluationAgents(),
      judge: {
        id: "judge",
        name: "Судья",
        status: "выносит вердикт",
        variant: "judge",
      },
    },
  };
}

export const mockWorkspaceSceneDto = {
  shell: {
    brand: {
      name: "Hypothesis Court",
    },
    navigation: {
      newChatLabel: "Новый чат",
      searchLabel: "Поиск",
    },
    currentChatId: "low-temp-electrolysis",
    user: {
      name: "Marina",
    },
  },
  sessions: [
    createSession({
      id: "low-temp-electrolysis",
      title: "Электролиз нового катализатора",
      query:
        "Стоит ли запускать проект по разработке катализатора для электролиза при низких температурах?",
      answer:
        "Рекомендация: начать ограниченный пилот, но не как широкий исследовательский проект, а как короткую проверку трёх самых рискованных допущений. Первая проверка должна подтвердить, что катализатор сохраняет активность после серии циклов при низкой температуре, потому что именно деградация сейчас выглядит главным техническим ограничением. Вторая проверка должна сравнить два маршрута синтеза: базовый лабораторный и упрощённый производственный, чтобы заранее увидеть, не исчезает ли выигрыш после снижения стоимости прекурсоров. Третья проверка должна оценить воспроизводимость результата на небольшой серии образцов, потому что разовый высокий показатель не даёт оснований запускать масштабирование. Финансово гипотеза выглядит перспективной при условии, что стоимость активного компонента удастся удержать в заданном диапазоне, а технологическое окно не потребует нового оборудования. Риск остаётся средним: проект может провалиться не из-за отсутствия эффекта, а из-за нестабильности результата при переносе из лабораторного режима в повторяемый процесс. Поэтому первый этап лучше ограничить четырьмя неделями, фиксированным набором KPI и заранее определённым критерием остановки. Если после пилота сохранятся активность, стоимость и повторяемость, гипотезу стоит переводить в следующий цикл обсуждения с усиленным участием производственного и финансового агентов.",
      attachments: [
        {
          id: "att-001",
          kind: "pdf",
          fileName: "electrolysis-review-2025.pdf",
          summary: "Обзор литературы по низкотемпературному электролизу и материалам катализатора.",
        },
        {
          id: "att-002",
          kind: "docx",
          fileName: "pilot-plan-draft.docx",
          summary: "Черновой план пилотной постановки и контрольных метрик по стабильности.",
        },
        {
          id: "att-003",
          kind: "xlsx",
          fileName: "precursor-cost-model.xlsx",
          summary: "Модель стоимости прекурсоров и сценарии закупки для масштабирования.",
        },
        {
          id: "att-004",
          kind: "csv",
          fileName: "lab-series-17.csv",
          summary: "Экспериментальные данные по деградации активности за 240 часов.",
        },
        {
          id: "att-005",
          kind: "txt",
          fileName: "meeting-notes.txt",
          summary: "Замечания технологов по чувствительности процесса к чистоте сырья.",
        },
        ...createAttachmentSeries({
          idPrefix: "att-review",
          count: 10,
          kind: "pdf",
          fileNamePrefix: "catalyst-literature-pack",
          summary: "Дополнительные статьи и обзоры для проверки исходной гипотезы.",
        }),
        ...createAttachmentSeries({
          idPrefix: "att-lab",
          count: 8,
          kind: "csv",
          fileNamePrefix: "electrolysis-lab-run",
          summary: "Сырые экспериментальные серии по стабильности и деградации.",
        }),
        ...createAttachmentSeries({
          idPrefix: "att-model",
          count: 6,
          kind: "xlsx",
          fileNamePrefix: "cost-sensitivity-model",
          summary: "Расчётные таблицы по стоимости прекурсоров и масштабированию.",
        }),
        ...createAttachmentSeries({
          idPrefix: "att-protocol",
          count: 4,
          kind: "docx",
          fileNamePrefix: "pilot-validation-protocol",
          summary: "Протоколы валидации и технологические ограничения пилота.",
        }),
      ],
    }),
    createSession({
      id: "algae-bioreactor",
      title: "Биореактор для водорослей",
      query:
        "Насколько перспективен R&D-проект по биореактору для микроводорослей с целью снижения себестоимости биомассы?",
      answer:
        "Имеет смысл идти в короткий цикл проверки гипотез, если сразу отсечь конфигурации с дорогой системой освещения. Ключевой шанс лежит в упрощении обслуживания и верификации прироста выхода на единицу площади, иначе экономический эффект быстро размывается.",
      hypothesisCount: 4,
      requestCount: 1,
      attachments: [
        {
          id: "att-101",
          kind: "pdf",
          fileName: "algae-reactor-benchmark.pdf",
          summary: "Сравнение геометрий фотобиореакторов и эксплуатационных ограничений.",
        },
        {
          id: "att-102",
          kind: "docx",
          fileName: "site-constraints.docx",
          summary: "Ограничения по площадке, санитарным зонам и энергоподводу.",
        },
        {
          id: "att-103",
          kind: "xlsx",
          fileName: "lighting-costs.xlsx",
          summary: "Разложение CAPEX и OPEX для сценариев досветки.",
        },
      ],
    }),
    createSession({
      id: "hydrogen-lohc",
      title: "Хранение водорода в LOHC",
      query:
        "Стоит ли проверять гипотезу хранения водорода в LOHC для региональной логистики на средних плечах?",
      answer:
        "Гипотеза выглядит жизнеспособной только при жёстком сценарии интеграции с уже существующей логистической цепочкой. Главный риск связан не с самой химией, а с циклом дегидрирования и требованиями к тепловому контуру на точке выгрузки.",
      hypothesisCount: 5,
      requestCount: 5,
      attachments: [
        {
          id: "att-201",
          kind: "pdf",
          fileName: "lohc-transport-study.pdf",
          summary: "Исследование логистики LOHC на плечах до 800 километров.",
        },
        {
          id: "att-202",
          kind: "csv",
          fileName: "cycle-losses.csv",
          summary: "Потери массы носителя и энергозатраты по циклам загрузки и выгрузки.",
        },
        {
          id: "att-203",
          kind: "txt",
          fileName: "operations-memo.txt",
          summary: "Комментарий службы эксплуатации по интеграции в существующий парк ёмкостей.",
        },
      ],
    }),
    createSession({
      id: "low-temp-plasma",
      title: "Низкотемпературная плазма",
      query:
        "Можно ли обосновать запуск программы по низкотемпературной плазме для активации поверхности полимера?",
      answer:
        "Да, но только если исследование сразу ограничить узкими сценариями применения и заранее привязать к измеримому росту адгезии. Без такого сужения проект рискует расползтись в демонстрации без производственного выхода.",
      hypothesisCount: 4,
      requestCount: 2,
      attachments: [
        {
          id: "att-301",
          kind: "pdf",
          fileName: "surface-activation.pdf",
          summary: "Карта режимов обработки и эффекта на контактный угол.",
        },
        {
          id: "att-302",
          kind: "xlsx",
          fileName: "line-retrofit.xlsx",
          summary: "Оценка стоимости встраивания плазменного модуля в текущую линию.",
        },
      ],
    }),
    createSession({
      id: "pet-enzyme",
      title: "Фермент для PET-рециклинга",
      query:
        "Есть ли основания запускать проект по ферментативному разложению PET на пилотном уровне?",
      answer:
        "Основания есть, если сфокусироваться на узком потоке сырья с контролируемым загрязнением. На смешанных и грязных потоках биокаталитическое окно слишком хрупкое, поэтому пилот лучше проектировать как доказательство применимости на премиальном сырье.",
      requestCount: 6,
      attachments: [
        {
          id: "att-401",
          kind: "pdf",
          fileName: "pet-enzymes-review.pdf",
          summary: "Обзор ферментных систем и температурных режимов для PET.",
        },
        {
          id: "att-402",
          kind: "docx",
          fileName: "feedstock-spec.docx",
          summary: "Спецификация допустимых примесей во входном сырье для пилота.",
        },
        {
          id: "att-403",
          kind: "csv",
          fileName: "depolymerization-results.csv",
          summary: "Сырые результаты по конверсии и накоплению ингибирующих примесей.",
        },
      ],
    }),
    createSession({
      id: "superconducting-cable",
      title: "Сверхпроводящий кабель",
      query:
        "Нужно ли начинать исследовательскую программу по сверхпроводящему кабелю для городских узлов высокой плотности?",
      answer:
        "Пока это скорее стратегическая разведка, чем быстрый продуктовый шанс. Сильный довод в пользу проекта есть только при наличии внешнего заказчика, который готов совместно нести стоимость демонстратора и инфраструктуры охлаждения.",
      requestCount: 4,
      attachments: [
        {
          id: "att-501",
          kind: "pdf",
          fileName: "urban-grid-study.pdf",
          summary: "Требования городских узлов и сценарии повышения плотности передачи.",
        },
        {
          id: "att-502",
          kind: "txt",
          fileName: "partner-call.txt",
          summary: "Заметки по переговорам с потенциальным заказчиком демонстратора.",
        },
      ],
    }),
    createSession({
      id: "aerogel-insulation",
      title: "Аэрогель для изоляции",
      query:
        "Насколько оправдан проект по аэрогелевой изоляции для компактных модулей с жёстким ограничением массы?",
      answer:
        "Проект выглядит сильным, если команда сразу проверит хрупкость, влагостойкость и технологичность формования в реальный модуль. У аэрогеля хорошая история по теплопроводности, но производственный риск часто недооценивают.",
      attachments: [
        {
          id: "att-601",
          kind: "pdf",
          fileName: "aerogel-materials.pdf",
          summary: "Материалы по механической стойкости и влагопоглощению аэрогеля.",
        },
        {
          id: "att-602",
          kind: "docx",
          fileName: "module-layout.docx",
          summary: "Ограничения компоновки и окна по массе для целевого модуля.",
        },
      ],
    }),
    createSession({
      id: "graphene-sensor",
      title: "Датчик на основе графена",
      query:
        "Стоит ли запускать поиск гипотез по графеновому сенсору для агрессивных сред?",
      answer:
        "Да, если сразу рассматривать не только чувствительность, но и воспроизводимость производства сенсорного слоя. Коммерческая ценность возможна, однако слабое место почти наверняка будет в разбросе параметров между партиями.",
      attachments: [
        {
          id: "att-701",
          kind: "pdf",
          fileName: "graphene-sensing.pdf",
          summary: "Механизмы сенсинга и ограничения по стабильности сигнала в агрессивных средах.",
        },
        {
          id: "att-702",
          kind: "xlsx",
          fileName: "batch-variance.xlsx",
          summary: "Оценка разброса параметров сенсоров между сериями осаждения.",
        },
      ],
    }),
    createSession({
      id: "alloy-optimization",
      title: "Оптимизация состава сплава",
      query:
        "Есть ли смысл запускать гипотезогенерацию для сплава с упором на прочность и коррозионную стойкость одновременно?",
      answer:
        "Есть, но полезность системы будет максимальной только при хорошем покрытии негативных результатов из прошлых серий. Для этого кейса особенно важно не повторять комбинации легирующих добавок, которые уже давали локальное охрупчивание.",
      attachments: [
        {
          id: "att-801",
          kind: "pdf",
          fileName: "alloy-failure-map.pdf",
          summary: "Карта провалов по сериям испытаний и микроструктурным причинам.",
        },
        {
          id: "att-802",
          kind: "csv",
          fileName: "salt-fog-results.csv",
          summary: "Результаты коррозионных испытаний в соляном тумане.",
        },
        {
          id: "att-803",
          kind: "txt",
          fileName: "metallurgy-notes.txt",
          summary: "Внутренние заметки по технологическим окнам термообработки.",
        },
      ],
    }),
    createSession({
      id: "anti-icing-coating",
      title: "Покрытие против обледенения",
      query:
        "Нужно ли разворачивать проект по покрытию против обледенения для уличных конструкций?",
      answer:
        "Проект можно запускать, если с самого начала развести лабораторный успех и реальную погодную стойкость. Основная неопределённость не в стартовой гидрофобности, а в деградации покрытия под абразивом, ультрафиолетом и циклическим обледенением.",
      attachments: [
        {
          id: "att-901",
          kind: "pdf",
          fileName: "anti-icing-coatings.pdf",
          summary: "Мета-анализ покрытий, механизмов срыва льда и долговечности.",
        },
        {
          id: "att-902",
          kind: "docx",
          fileName: "field-test-plan.docx",
          summary: "План натурных испытаний и сценарии климатической валидации.",
        },
      ],
    }),
    createSession({
      id: "ceramic-3d-printing",
      title: "3D-печать керамикой",
      query:
        "Стоит ли исследовать 3D-печать керамикой для быстрых серий функциональных компонентов?",
      answer:
        "Да, если ключевой KPI будет не только геометрическая свобода, но и доля годных после спекания. Проект интересный, но быстро упрётся в усадку, повторяемость и экономику постобработки.",
      attachments: [
        {
          id: "att-1001",
          kind: "pdf",
          fileName: "ceramic-additive-review.pdf",
          summary: "Технологии печати, режимы спекания и типовые дефекты.",
        },
        {
          id: "att-1002",
          kind: "xlsx",
          fileName: "yield-model.xlsx",
          summary: "Модель выхода годных по типам дефектов и сценариям усадки.",
        },
      ],
    }),
    createSession({
      id: "methanol-co2",
      title: "Получение метанола из CO2",
      query:
        "Есть ли основания запускать новое направление по синтезу метанола из CO2 на доступном сырье?",
      answer:
        "Основания есть для аналитического этапа, но не для полномасштабного пилота без уточнения цены водорода и источника CO2. Экономика здесь чувствительна к внешним допущениям сильнее, чем к самому каталитическому блоку.",
      attachments: [
        {
          id: "att-1101",
          kind: "pdf",
          fileName: "methanol-from-co2.pdf",
          summary: "Обзор технологических цепочек синтеза метанола из CO2.",
        },
        {
          id: "att-1102",
          kind: "csv",
          fileName: "sensitivity-scan.csv",
          summary: "Чувствительность себестоимости к цене H2 и источнику диоксида углерода.",
        },
      ],
    }),
    createSession({
      id: "new-phosphors",
      title: "Новые люминофоры",
      query:
        "Нужно ли запускать поиск гипотез по новым люминофорам для высокотемпературных режимов работы?",
      answer:
        "Да, но проект стоит ограничить узкими системами матрица-активатор и заранее поставить барьер по доступности редких компонентов. Иначе исследование станет научно интересным, но слишком далёким от практической применимости.",
      attachments: [
        {
          id: "att-1201",
          kind: "pdf",
          fileName: "phosphor-thermal-quenching.pdf",
          summary: "Механизмы теплового тушения и пути стабилизации свечения.",
        },
        {
          id: "att-1202",
          kind: "txt",
          fileName: "rare-earth-supply.txt",
          summary: "Заметки по рискам поставок и ценовым ограничениям по редким компонентам.",
        },
      ],
    }),
    createSession({
      id: "ammonia-catalyst",
      title: "Катализатор для аммиака",
      query:
        "Можно ли обосновать исследование катализатора для аммиака с упором на снижение давления процесса?",
      answer:
        "Да, если прямо сейчас принять, что выигрыш по давлению должен быть сопоставим с потерями по скорости реакции и ресурсу катализатора. Без этого проект будет красиво выглядеть на уровне идеи, но не пройдёт производственный фильтр.",
      attachments: [
        {
          id: "att-1301",
          kind: "pdf",
          fileName: "ammonia-catalyst-review.pdf",
          summary: "Низконапорные каталитические схемы и ограничения по активности.",
        },
        {
          id: "att-1302",
          kind: "docx",
          fileName: "reactor-constraints.docx",
          summary: "Ограничения действующего реакторного контура и доступных материалов.",
        },
      ],
    }),
    createSession({
      id: "desalination-membranes",
      title: "Мембраны для опреснения",
      query:
        "Нужно ли запускать проект по новым мембранам для опреснения с целью роста ресурса и снижения загрязнения?",
      answer:
        "Да, если в основу ляжет не только селективность, но и стойкость к реальному загрязняющему профилю воды. Для этой темы особенно важно, чтобы данные по лабораторным растворам не маскировали проблемы от реальных органических и биологических загрязнений.",
      attachments: [
        {
          id: "att-1401",
          kind: "pdf",
          fileName: "desalination-membrane-fouling.pdf",
          summary: "Обзор фолинга мембран и методов повышения ресурса.",
        },
        {
          id: "att-1402",
          kind: "xlsx",
          fileName: "cleaning-economics.xlsx",
          summary: "Экономика регенерации и сценарии снижения частоты промывок.",
        },
      ],
    }),
  ],
  palette: {
    addAgentLabel: "Добавить агента",
    agents: [
      {
        id: "agent-finance",
        name: "Финансовый",
        variant: "finance",
        isEmpty: false,
      },
      {
        id: "agent-risk",
        name: "Риск-агент",
        variant: "risk",
        isEmpty: false,
      },
      {
        id: "agent-empty-1",
        name: "Пустой агент",
        variant: "empty",
        isEmpty: true,
      },
      {
        id: "agent-empty-2",
        name: "Пустой агент",
        variant: "empty",
        isEmpty: true,
      },
      {
        id: "agent-empty-3",
        name: "Пустой агент",
        variant: "empty",
        isEmpty: true,
      },
      {
        id: "agent-empty-4",
        name: "Пустой агент",
        variant: "empty",
        isEmpty: true,
      },
    ],
  },
  composer: {
    placeholder: "Сообщите Hypothesis Court...",
    attachLabel: "Прикрепить файл",
    sendLabel: "Отправить сообщение",
  },
};
