# Panduan Melatih AI Sendiri (Fine-Tuning di Google Colab)

Dokumen ini menjelaskan cara menggunakan dataset hasil generator untuk melatih model AI sendiri menggunakan **Unsloth / Hugging Face LoRA** secara gratis di **Google Colab**.

---

## 1. Menghasilkan Dataset

Jalankan perintah berikut di terminal:
```bash
# Menghasilkan 20 contoh naskah & breakdown
node scripts/generate_dataset.mjs 20

# Atau jika ingin 100 naskah:
node scripts/generate_dataset.mjs 100
```
Hasil dataset akan tersimpan dalam file: `dataset/script_breakdown_train.jsonl`.

---

## 2. Buka Google Colab

1. Buka [Google Colab](https://colab.research.google.com/) (Gratis).
2. Ubah runtime ke GPU: **Runtime > Change runtime type > T4 GPU**.

---

## 3. Salin Kode Training Berikut ke Google Colab

```python
# 1. Install library Unsloth & Transformers (Pelatihan 2x lebih cepat & hemat VRAM)
!pip install --no-deps "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
!pip install --no-deps trl peft accelerate bitsandbytes datasets

# 2. Muat Base Model (Contoh: Google Gemma 2B atau LLaMA 3 8B)
from unsloth import FastLanguageModel
import torch

max_seq_length = 1024
dtype = None # Auto detect
load_in_4bit = True # 4-bit quantization agar muat di GPU gratis

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = "unsloth/gemma-2-2b-it-bnb-4bit",
    max_seq_length = max_seq_length,
    dtype = dtype,
    load_in_4bit = load_in_4bit,
)

# 3. Pasang LoRA Adapters
model = FastLanguageModel.get_peft_model(
    model,
    r = 16,
    target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_alpha = 16,
    lora_dropout = 0,
    bias = "none",
)

# 4. Muat Dataset .jsonl yang telah Anda buat
from datasets import load_dataset
# Upload file script_breakdown_train.jsonl ke Google Colab di panel sebelah kiri
dataset = load_dataset("json", data_files="script_breakdown_train.jsonl", split="train")

# Format prompt
prompt_format = """### Instruksi:
{}

### Naskah:
{}

### Elemen Breakdown (JSON):
{}"""

def formatting_prompts_func(examples):
    instructions = examples["instruction"]
    inputs       = examples["input"]
    outputs      = examples["output"]
    texts = []
    for instruction, input_text, output in zip(instructions, inputs, outputs):
        text = prompt_format.format(instruction, input_text, output)
        texts.append(text)
    return { "text" : texts }

dataset = dataset.map(formatting_prompts_func, batched = True)

# 5. Jalankan Training (Hanya butuh ~10-20 menit di Colab T4)
from trl import SFTTrainer
from transformers import TrainingArguments

trainer = SFTTrainer(
    model = model,
    tokenizer = tokenizer,
    train_dataset = dataset,
    dataset_text_field = "text",
    max_seq_length = max_seq_length,
    dataset_num_proc = 2,
    packing = False,
    args = TrainingArguments(
        per_device_train_batch_size = 2,
        gradient_accumulation_steps = 4,
        warmup_steps = 5,
        max_steps = 60, # Atur langkah sesuai jumlah dataset
        learning_rate = 2e-4,
        fp16 = not torch.cuda.is_bf16_supported(),
        bf16 = torch.cuda.is_bf16_supported(),
        logging_steps = 1,
        output_dir = "outputs",
    ),
)

trainer.train()

# 6. Simpan Model Hasil Fine-Tuning
model.save_pretrained("scriptflow_model_custom")
tokenizer.save_pretrained("scriptflow_model_custom")
print("🎉 Pelatihan selesai! Model siap digunakan.")
```

---

## 4. Cara Uji Coba Model Hasil Training di Colab:

```python
FastLanguageModel.for_inference(model)
inputs = tokenizer(
[
    prompt_format.format(
        "Ekstrak semua elemen kebutuhan produksi (breakdown) dari adegan naskah film berikut ke dalam format JSON terstruktur.",
        "INT. WARUNG KOPI - MALAM. Budi duduk melamun memegang cangkir kopi panas.",
        ""
    )
], return_tensors = "pt").to("cuda")

outputs = model.generate(**inputs, max_new_tokens = 256, use_cache = True)
print(tokenizer.batch_decode(outputs)[0])
```
