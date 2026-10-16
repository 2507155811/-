#include <jni.h>
#include <llama.h>
#include <atomic>
#include <mutex>
#include <vector>
#include <string>
#include <memory>
#include <chrono>
static std::mutex mutex;
static llama_model *model=nullptr;
static std::atomic<bool> cancelled(false);
static std::mutex error_mutex;
static std::string model_error;
static void capture_error(enum ggml_log_level level,const char *text,void *) {
 if(level!=GGML_LOG_LEVEL_ERROR||!text)return;
 std::lock_guard<std::mutex> lock(error_mutex);model_error+=text;
 if(model_error.size()>1200)model_error.erase(0,model_error.size()-1200);
}
static std::chrono::steady_clock::time_point deadline;
static bool abort_generation(void *) {return cancelled.load()||std::chrono::steady_clock::now()>deadline;}
static void fail(JNIEnv *env,const char *message){env->ThrowNew(env->FindClass("java/lang/IllegalStateException"),message);}
extern "C" JNIEXPORT void JNICALL Java_com_momo_companion_MomoNativePlugin_nativeLoad(JNIEnv *env,jclass,jstring path){
 std::lock_guard<std::mutex> lock(mutex);if(model){llama_model_free(model);model=nullptr;}{std::lock_guard<std::mutex> errors(error_mutex);model_error.clear();}llama_log_set(capture_error,nullptr);llama_backend_init();auto params=llama_model_default_params();params.n_gpu_layers=0;params.progress_callback=[](float,void*){return !cancelled.load();};const char *name=env->GetStringUTFChars(path,nullptr);model=llama_model_load_from_file(name,params);env->ReleaseStringUTFChars(path,name);if(!model){std::lock_guard<std::mutex> errors(error_mutex);std::string message=cancelled.load()?"Model loading cancelled":"Failed to load GGUF model: "+model_error;fail(env,message.c_str());}
}
extern "C" JNIEXPORT void JNICALL Java_com_momo_companion_MomoNativePlugin_nativeUnload(JNIEnv *,jclass){std::lock_guard<std::mutex> lock(mutex);if(model){llama_model_free(model);model=nullptr;}llama_backend_free();}
extern "C" JNIEXPORT void JNICALL Java_com_momo_companion_MomoNativePlugin_nativeBegin(JNIEnv *,jclass){cancelled.store(false);}
extern "C" JNIEXPORT void JNICALL Java_com_momo_companion_MomoNativePlugin_nativeCancel(JNIEnv *,jclass){cancelled.store(true);}
extern "C" JNIEXPORT jbyteArray JNICALL Java_com_momo_companion_MomoNativePlugin_nativeComplete(JNIEnv *env,jclass,jbyteArray input,jint threads,jint maxTokens){
 std::lock_guard<std::mutex> lock(mutex);if(!model){fail(env,"Model is not loaded");return nullptr;}deadline=std::chrono::steady_clock::now()+std::chrono::seconds(60);
 const int length=env->GetArrayLength(input);std::string prompt(length,'\0');env->GetByteArrayRegion(input,0,length,reinterpret_cast<jbyte*>(prompt.data()));
 const llama_vocab *vocab=llama_model_get_vocab(model);int count=-llama_tokenize(vocab,prompt.data(),length,nullptr,0,true,true);if(count<=0||count>1800){fail(env,"Prompt exceeds the low-power context budget");return nullptr;}
 std::vector<llama_token> tokens(count);llama_tokenize(vocab,prompt.data(),length,tokens.data(),count,true,true);
 auto params=llama_context_default_params();params.n_ctx=2048;params.n_batch=256;params.n_threads=std::max(1,std::min(2,(int)threads));params.n_threads_batch=params.n_threads;params.abort_callback=abort_generation;
 std::unique_ptr<llama_context,decltype(&llama_free)> ctx(llama_init_from_model(model,params),llama_free);if(!ctx){fail(env,"Cannot allocate inference context");return nullptr;}
 for(int offset=0;offset<count;offset+=256){int n=std::min(256,count-offset);if(llama_decode(ctx.get(),llama_batch_get_one(tokens.data()+offset,n))!=0){fail(env,"Inference cancelled or prompt evaluation failed");return nullptr;}}
 std::unique_ptr<llama_sampler,decltype(&llama_sampler_free)> sampler(llama_sampler_init_greedy(),llama_sampler_free);std::string response;
 for(int i=0;i<std::max(1,std::min(128,(int)maxTokens));i++){if(abort_generation(nullptr)){fail(env,"Inference cancelled or timed out");return nullptr;}llama_token token=llama_sampler_sample(sampler.get(),ctx.get(),-1);if(llama_vocab_is_eog(vocab,token))break;char buffer[256];int size=llama_token_to_piece(vocab,token,buffer,sizeof(buffer),0,false);if(size>0)response.append(buffer,size);if(llama_decode(ctx.get(),llama_batch_get_one(&token,1))!=0){fail(env,"Inference cancelled or decoding failed");return nullptr;}}
 jbyteArray result=env->NewByteArray(response.size());env->SetByteArrayRegion(result,0,response.size(),reinterpret_cast<const jbyte*>(response.data()));return result;
}
